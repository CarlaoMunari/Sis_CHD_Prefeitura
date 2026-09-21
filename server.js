const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { Pool } = require('pg');

// Carregar .env localmente se existir
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const SALT = 'toners_system_salt_2026';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('⚠️ AVISO: DATABASE_URL não está definida nas variáveis de ambiente!');
}

// Conexão com Supabase PostgreSQL via Pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Content Types para servir arquivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// Hashing de senha (SHA-256 HMAC)
function hashPassword(password) {
  return crypto.createHmac('sha256', SALT).update(password).digest('hex');
}

// Auxiliar para enviar resposta JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

// Auxiliar para ler corpo da requisição POST/PUT
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', err => reject(err));
  });
}

// Auxiliar para obter usuário requisitante a partir do header Authorization
async function getRequesterUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  const match = token.match(/^token_(\d+)_/);
  if (!match) return null;
  const userId = parseInt(match[1], 10);
  try {
    const userRes = await pool.query('SELECT id, login, nome, email, departamento, role, ativo, status FROM users WHERE id = $1', [userId]);
    return userRes.rows.length > 0 ? userRes.rows[0] : null;
  } catch (err) {
    console.error('Erro ao verificar usuário do token:', err);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // ============================================
  // API DE REGISTRO PÚBLICO: /api/register
  // ============================================
  if (pathname === '/api/register' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { login, nome, email, departamento, password } = body;

      if (!nome || !email || !password || !login) {
        return sendJSON(res, 400, { error: 'Todos os campos obrigatórios devem ser preenchidos.' });
      }

      if (password.length < 4) {
        return sendJSON(res, 400, { error: 'A senha deve ter pelo menos 4 caracteres.' });
      }

      const userLogin = login.trim();
      const userEmail = email.trim().toLowerCase();

      // Validar duplicatas (email ou login)
      const dupRes = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(login) = $2',
        [userEmail, userLogin.toLowerCase()]
      );

      if (dupRes.rows.length > 0) {
        return sendJSON(res, 400, { error: 'Este e-mail ou nome de usuário já está cadastrado ou com cadastro pendente.' });
      }

      await pool.query(
        `INSERT INTO users
          (login, nome, email, departamento, password_hash, role, ativo, status, criado_por, data_criacao)
         VALUES ($1, $2, $3, $4, $5, 'USUARIO', false, 'PENDENTE', 'AUTO_CADASTRO', NOW())`,
        [
          userLogin,
          String(nome).trim(),
          userEmail,
          String(departamento || 'GERAL').trim().toUpperCase(),
          hashPassword(password)
        ]
      );

      return sendJSON(res, 201, { message: 'Solicitação de cadastro enviada com sucesso! Aguarde a aprovação do administrador.' });
    } catch (err) {
      console.error('Erro /api/register:', err);
      return sendJSON(res, 500, { error: err.message || 'Erro ao processar solicitação de cadastro.' });
    }
  }

  // ============================================
  // API DE AUTENTICAÇÃO: /api/auth/login
  // ============================================
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { email, username, password } = body;
      const loginTerm = (username || email || '').toLowerCase().trim();

      if (!loginTerm || !password) {
        return sendJSON(res, 400, { error: 'Usuário/E-mail e senha são obrigatórios.' });
      }

      const hashed = hashPassword(password);
      const userRes = await pool.query(
        `SELECT * FROM users
         WHERE (LOWER(login) = $1 OR LOWER(email) = $1) AND password_hash = $2`,
        [loginTerm, hashed]
      );

      if (userRes.rows.length === 0) {
        return sendJSON(res, 401, { error: 'Usuário ou senha incorretos.' });
      }

      const user = userRes.rows[0];

      if (user.status === 'PENDENTE') {
        return sendJSON(res, 403, { error: 'Cadastro aguardando aprovação do administrador. Você será notificado.' });
      }

      if (user.status === 'REJEITADO') {
        return sendJSON(res, 403, { error: 'Seu cadastro foi rejeitado. Entre em contato com o Departamento de Tecnologia - 17 3285-9997.' });
      }

      if (!user.ativo) {
        return sendJSON(res, 403, { error: 'Conta desativada pelo administrador.' });
      }

      const token = `token_${user.id}_${Date.now()}`;
      const userPayload = {
        id: user.id,
        login: user.login || user.email,
        nome: user.nome,
        email: user.email,
        departamento: user.departamento || (user.role !== 'USUARIO' ? 'TECNOLOGIA' : 'GERAL'),
        role: user.role
      };

      return sendJSON(res, 200, { token, user: userPayload });
    } catch (err) {
      console.error('Erro /api/auth/login:', err);
      return sendJSON(res, 500, { error: err.message || 'Requisição inválida.' });
    }
  }

  // ============================================
  // API DE GESTÃO DE USUÁRIOS: /api/users
  // ============================================
  if (pathname.startsWith('/api/users')) {
    const subPath = pathname.replace('/api/users', '');

    // GET /api/users
    if (method === 'GET' && (subPath === '' || subPath === '/')) {
      try {
        const result = await pool.query(
          `SELECT
             id, login, nome, email, departamento, role, ativo, status,
             criado_por AS "criadoPor", data_criacao AS "dataCriacao"
           FROM users ORDER BY id ASC`
        );
        return sendJSON(res, 200, result.rows);
      } catch (err) {
        console.error('Erro GET /api/users:', err);
        return sendJSON(res, 500, { error: 'Erro ao carregar usuários.' });
      }
    }

    // POST /api/users (Criar usuário pelo Admin)
    if (method === 'POST' && (subPath === '' || subPath === '/')) {
      try {
        const body = await getRequestBody(req);
        const { login, nome, email, departamento, password, role, criadoPor } = body;

        if (!nome || !email || !password || !role) {
          return sendJSON(res, 400, { error: 'Todos os campos obrigatórios devem ser preenchidos.' });
        }

        const userLogin = (login || email.split('@')[0]).trim();
        const userEmail = email.trim().toLowerCase();

        // Validar duplicatas
        const dupRes = await pool.query(
          'SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(login) = $2',
          [userEmail, userLogin.toLowerCase()]
        );
        if (dupRes.rows.length > 0) {
          return sendJSON(res, 400, { error: 'Este e-mail ou nome de usuário já está cadastrado.' });
        }

        // REGRA DE NEGÓCIO RBAC: ADMIN só cria 'USUARIO'
        if (criadoPor) {
          const creatorRes = await pool.query(
            'SELECT role FROM users WHERE LOWER(email) = $1 OR LOWER(login) = $2',
            [criadoPor.toLowerCase().trim(), criadoPor.toLowerCase().trim()]
          );
          if (creatorRes.rows.length > 0 && creatorRes.rows[0].role === 'ADMIN' && role !== 'USUARIO') {
            return sendJSON(res, 403, { error: 'Administradores só podem criar contas de perfil USUÁRIO.' });
          }
        }

        const userDept = (role === 'ADMIN' || role === 'SUPER_ADMIN') ? 'TECNOLOGIA' : (departamento ? String(departamento).trim().toUpperCase() : 'GERAL');

        const insertRes = await pool.query(
          `INSERT INTO users
            (login, nome, email, departamento, password_hash, role, ativo, status, criado_por, data_criacao)
           VALUES ($1, $2, $3, $4, $5, $6, true, 'APROVADO', $7, NOW())
           RETURNING
            id, login, nome, email, departamento, role, ativo, status,
            criado_por AS "criadoPor", data_criacao AS "dataCriacao"`,
          [userLogin, String(nome).trim(), userEmail, userDept, hashPassword(password), role, criadoPor || 'ADMIN']
        );

        return sendJSON(res, 201, insertRes.rows[0]);
      } catch (err) {
        console.error('Erro POST /api/users:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao criar usuário.' });
      }
    }

    // PUT /api/users/:id/change-password (Alterar Senha)
    const changePassMatch = subPath.match(/^\/(\d+)\/change-password$/);
    if (method === 'PUT' && changePassMatch) {
      const id = parseInt(changePassMatch[1], 10);
      try {
        const body = await getRequestBody(req);
        const { newPassword, currentPassword, isAdminReset } = body;

        if (!newPassword || newPassword.length < 4) {
          return sendJSON(res, 400, { error: 'A nova senha deve conter pelo menos 4 caracteres.' });
        }

        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
        }
        const user = userRes.rows[0];

        if (!isAdminReset) {
          const hashedCurrent = hashPassword(currentPassword || '');
          if (user.password_hash !== hashedCurrent) {
            return sendJSON(res, 400, { error: 'A senha atual informada está incorreta.' });
          }
        }

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(newPassword), id]);
        return sendJSON(res, 200, { message: `Senha do usuário ${user.login} alterada com sucesso!` });
      } catch (err) {
        console.error('Erro change-password:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao alterar senha.' });
      }
    }

    // PUT /api/users/:id/aprovar (Aprovar cadastro pendente)
    const aprovarMatch = subPath.match(/^\/(\d+)\/aprovar$/);
    if (method === 'PUT' && aprovarMatch) {
      const id = parseInt(aprovarMatch[1], 10);
      try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
        }
        const user = userRes.rows[0];
        if (user.status !== 'PENDENTE') {
          return sendJSON(res, 400, { error: 'Este usuário não está com cadastro pendente.' });
        }

        const body = await getRequestBody(req);
        const novoNome = body.nome ? String(body.nome).trim() : user.nome;
        const novoLogin = body.login ? String(body.login).trim() : user.login;
        const novoEmail = body.email ? String(body.email).trim().toLowerCase() : user.email;
        const novoDepto = body.departamento ? String(body.departamento).trim().toUpperCase() : user.departamento;
        const novoRole = body.role || user.role;

        const updateRes = await pool.query(
          `UPDATE users
           SET status = 'APROVADO',
               ativo = true,
               aprovado_por = $1,
               data_aprovacao = NOW(),
               nome = $2,
               login = $3,
               email = $4,
               departamento = $5,
               role = $6
           WHERE id = $7
           RETURNING
            id, login, nome, email, departamento, role, ativo, status,
            criado_por AS "criadoPor", data_criacao AS "dataCriacao"`,
          [body.aprovadoPor || 'ADMIN', novoNome, novoLogin, novoEmail, novoDepto, novoRole, id]
        );

        return sendJSON(res, 200, { message: `Usuário "${novoLogin}" aprovado com sucesso!`, user: updateRes.rows[0] });
      } catch (err) {
        console.error('Erro /aprovar:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao aprovar usuário.' });
      }
    }

    // PUT /api/users/:id/rejeitar (Rejeitar e excluir cadastro pendente)
    const rejeitarMatch = subPath.match(/^\/(\d+)\/rejeitar$/);
    if (method === 'PUT' && rejeitarMatch) {
      const id = parseInt(rejeitarMatch[1], 10);
      try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
        }
        const user = userRes.rows[0];
        if (user.status !== 'PENDENTE') {
          return sendJSON(res, 400, { error: 'Apenas cadastros pendentes podem ser rejeitados.' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return sendJSON(res, 200, { message: `Solicitação de cadastro de "${user.nome}" foi rejeitada e removida.` });
      } catch (err) {
        console.error('Erro /rejeitar:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao rejeitar cadastro.' });
      }
    }

    // PUT /api/users/:id (Editar dados do usuário pelo Admin)
    const editUserMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'PUT' && editUserMatch) {
      const id = parseInt(editUserMatch[1], 10);
      try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
        }
        const user = userRes.rows[0];
        const body = await getRequestBody(req);

        const novoNome = body.nome ? String(body.nome).trim() : user.nome;
        const novoLogin = body.login ? String(body.login).trim() : user.login;
        const novoEmail = body.email ? String(body.email).trim().toLowerCase() : user.email;
        const novoRole = body.role || user.role;

        let novoDepto = user.departamento;
        if (novoRole === 'ADMIN' || novoRole === 'SUPER_ADMIN') {
          novoDepto = 'TECNOLOGIA';
        } else if (body.departamento) {
          novoDepto = String(body.departamento).trim().toUpperCase();
        }

        const updateRes = await pool.query(
          `UPDATE users
           SET nome = $1, login = $2, email = $3, role = $4, departamento = $5
           WHERE id = $6
           RETURNING
            id, login, nome, email, departamento, role, ativo, status,
            criado_por AS "criadoPor", data_criacao AS "dataCriacao"`,
          [novoNome, novoLogin, novoEmail, novoRole, novoDepto, id]
        );

        return sendJSON(res, 200, { message: 'Dados do usuário atualizados com sucesso!', user: updateRes.rows[0] });
      } catch (err) {
        console.error('Erro PUT /api/users/:id:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao atualizar usuário.' });
      }
    }

    // DELETE /api/users/:id
    const deleteUserMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'DELETE' && deleteUserMatch) {
      const id = parseInt(deleteUserMatch[1], 10);
      try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
        }
        if (userRes.rows[0].role === 'SUPER_ADMIN') {
          return sendJSON(res, 403, { error: 'Não é possível excluir a conta de SUPER_ADMIN principal.' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return sendJSON(res, 200, { message: 'Usuário excluído com sucesso.' });
      } catch (err) {
        console.error('Erro DELETE /api/users/:id:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao excluir usuário.' });
      }
    }
  }

  // ============================================
  // API DE CHAMADOS (TICKETS): /api/tickets
  // ============================================
  if (pathname.startsWith('/api/tickets')) {
    const subPath = pathname.replace('/api/tickets', '');

    // GET /api/tickets
    if (method === 'GET' && (subPath === '' || subPath === '/')) {
      try {
        const result = await pool.query(`
          SELECT
            id, codigo,
            solicitante_id AS "solicitanteId",
            solicitante_nome AS "solicitanteNome",
            solicitante_email AS "solicitanteEmail",
            solicitante_departamento AS "solicitanteDepartamento",
            categoria,
            detalhes_toner AS "detalhesToner",
            descricao,
            status,
            prioridade,
            atendido_por AS "atendidoPor",
            baixa_estoque_realizada AS "baixaEstoqueRealizada",
            data_abertura AS "dataAbertura",
            data_finalizacao AS "dataFinalizacao",
            historico
          FROM tickets
          ORDER BY id DESC
        `);
        return sendJSON(res, 200, result.rows);
      } catch (err) {
        console.error('Erro GET /api/tickets:', err);
        return sendJSON(res, 500, { error: 'Erro ao carregar chamados.' });
      }
    }

    // POST /api/tickets (Criar chamado)
    if (method === 'POST' && (subPath === '' || subPath === '/')) {
      try {
        const body = await getRequestBody(req);
        const { solicitanteId, solicitanteNome, solicitanteEmail, solicitanteDepartamento, categoria, detalhesToner, descricao, prioridade } = body;

        if (!solicitanteNome || !categoria || !descricao) {
          return sendJSON(res, 400, { error: 'Solicitante, Categoria e Descrição são obrigatórios.' });
        }

        const nextIdRes = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tickets');
        const newId = parseInt(nextIdRes.rows[0].next_id, 10);
        const codigo = `CHM-2026-${String(newId).padStart(4, '0')}`;

        const historico = [
          {
            data: new Date().toISOString(),
            usuario: solicitanteNome,
            acao: 'Chamado aberto no sistema.'
          }
        ];

        const insertRes = await pool.query(
          `INSERT INTO tickets
            (codigo, solicitante_id, solicitante_nome, solicitante_email, solicitante_departamento,
             categoria, detalhes_toner, descricao, status, prioridade, atendido_por,
             baixa_estoque_realizada, data_abertura, data_finalizacao, historico)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ABERTO', $9, NULL, false, NOW(), NULL, $10)
           RETURNING
            id, codigo,
            solicitante_id AS "solicitanteId",
            solicitante_nome AS "solicitanteNome",
            solicitante_email AS "solicitanteEmail",
            solicitante_departamento AS "solicitanteDepartamento",
            categoria,
            detalhes_toner AS "detalhesToner",
            descricao,
            status,
            prioridade,
            atendido_por AS "atendidoPor",
            baixa_estoque_realizada AS "baixaEstoqueRealizada",
            data_abertura AS "dataAbertura",
            data_finalizacao AS "dataFinalizacao",
            historico`,
          [
            codigo,
            solicitanteId || 0,
            String(solicitanteNome).trim(),
            String(solicitanteEmail || '').trim(),
            String(solicitanteDepartamento || 'GERAL').toUpperCase(),
            categoria,
            detalhesToner ? JSON.stringify(detalhesToner) : null,
            String(descricao).trim(),
            prioridade || 'NORMAL',
            JSON.stringify(historico)
          ]
        );

        return sendJSON(res, 201, insertRes.rows[0]);
      } catch (err) {
        console.error('Erro POST /api/tickets:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao registrar chamado.' });
      }
    }

    // POST /api/tickets/:id/finalizar (Finalizar chamado & Dar Baixa Automática no Estoque)
    const finalizarMatch = subPath.match(/^\/(\d+)\/finalizar$/);
    if (method === 'POST' && finalizarMatch) {
      const id = parseInt(finalizarMatch[1], 10);
      try {
        const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Chamado não encontrado.' });
        }
        const ticket = ticketRes.rows[0];
        let historico = Array.isArray(ticket.historico) ? ticket.historico : (typeof ticket.historico === 'string' ? JSON.parse(ticket.historico) : []);
        let mensagemEstoque = '';
        let baixaRealizada = ticket.baixa_estoque_realizada;

        let detalhesToner = ticket.detalhes_toner;
        if (typeof detalhesToner === 'string') detalhesToner = JSON.parse(detalhesToner);

        if (ticket.categoria === 'Solicitação de Toners e Tintas' && detalhesToner && detalhesToner.itens && !baixaRealizada) {
          let itensDescontados = 0;

          for (const item of detalhesToner.itens) {
            let tonerRow = null;
            if (item.tonerId) {
              const tRes = await pool.query('SELECT * FROM toners WHERE id = $1', [item.tonerId]);
              if (tRes.rows.length > 0) tonerRow = tRes.rows[0];
            }
            if (!tonerRow && item.marca && item.modelo) {
              const tRes = await pool.query('SELECT * FROM toners WHERE marca = $1 AND modelo = $2', [item.marca, item.modelo]);
              if (tRes.rows.length > 0) tonerRow = tRes.rows[0];
            }

            if (tonerRow) {
              const isInk = tonerRow.toner.toLowerCase().includes('tank') || tonerRow.toner.toLowerCase().includes('tinta');
              if (!isInk) {
                const qtdDesconto = parseInt(item.quantidadeSolicitada) || 1;
                const novaQtd = Math.max(0, tonerRow.quantidade - qtdDesconto);
                const realizarPedido = novaQtd <= tonerRow.estoque_minimo;
                await pool.query(
                  'UPDATE toners SET quantidade = $1, realizar_pedido = $2 WHERE toner = $3',
                  [novaQtd, realizarPedido, tonerRow.toner]
                );
                itensDescontados += qtdDesconto;
              }
            }
          }
          baixaRealizada = true;
          mensagemEstoque = ` Baixa automática no estoque realizada (${itensDescontados} unidade(s)).`;
        }

        historico.push({
          data: new Date().toISOString(),
          usuario: 'ADMIN',
          acao: `Chamado finalizado.${mensagemEstoque}`
        });

        const updateRes = await pool.query(
          `UPDATE tickets
           SET status = 'FINALIZADO',
               data_finalizacao = NOW(),
               baixa_estoque_realizada = $1,
               historico = $2
           WHERE id = $3
           RETURNING
            id, codigo,
            solicitante_id AS "solicitanteId",
            solicitante_nome AS "solicitanteNome",
            solicitante_email AS "solicitanteEmail",
            solicitante_departamento AS "solicitanteDepartamento",
            categoria,
            detalhes_toner AS "detalhesToner",
            descricao,
            status,
            prioridade,
            atendido_por AS "atendidoPor",
            baixa_estoque_realizada AS "baixaEstoqueRealizada",
            data_abertura AS "dataAbertura",
            data_finalizacao AS "dataFinalizacao",
            historico`,
          [baixaRealizada, JSON.stringify(historico), id]
        );

        return sendJSON(res, 200, {
          message: `Chamado finalizado com sucesso!${mensagemEstoque}`,
          ticket: updateRes.rows[0]
        });
      } catch (err) {
        console.error('Erro POST /finalizar:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao finalizar chamado.' });
      }
    }

    // PUT /api/tickets/:id (Atualizar chamado / alteração por admin)
    const editTicketMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'PUT' && editTicketMatch) {
      const id = parseInt(editTicketMatch[1], 10);
      try {
        const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Chamado não encontrado.' });
        }
        const ticket = ticketRes.rows[0];
        const body = await getRequestBody(req);
        let historico = Array.isArray(ticket.historico) ? ticket.historico : (typeof ticket.historico === 'string' ? JSON.parse(ticket.historico) : []);
        let novoStatus = ticket.status;
        let novoDetalhesToner = ticket.detalhes_toner;

        if (body.status) {
          novoStatus = body.status;
          historico.push({
            data: new Date().toISOString(),
            usuario: 'ADMIN',
            acao: `Status alterado para ${body.status}`
          });
        }

        if (body.detalhesToner) {
          novoDetalhesToner = body.detalhesToner;
          const itensStr = body.detalhesToner.itens ? body.detalhesToner.itens.map(i => `${i.quantidadeSolicitada}x ${i.toner}`).join(', ') : '';
          historico.push({
            data: new Date().toISOString(),
            usuario: 'ADMIN',
            acao: `Pedido de suprimento alterado pelo Admin: ${body.detalhesToner.modeloImpressora} (${itensStr})`
          });
        } else if (body.newPrinterModel && novoDetalhesToner) {
          if (typeof novoDetalhesToner === 'string') novoDetalhesToner = JSON.parse(novoDetalhesToner);
          novoDetalhesToner = { ...novoDetalhesToner, modeloImpressora: body.newPrinterModel };
          historico.push({
            data: new Date().toISOString(),
            usuario: 'ADMIN',
            acao: `Modelo da impressora corrigido para: ${body.newPrinterModel}`
          });
        }

        const updateRes = await pool.query(
          `UPDATE tickets
           SET status = $1, detalhes_toner = $2, historico = $3
           WHERE id = $4
           RETURNING
            id, codigo,
            solicitante_id AS "solicitanteId",
            solicitante_nome AS "solicitanteNome",
            solicitante_email AS "solicitanteEmail",
            solicitante_departamento AS "solicitanteDepartamento",
            categoria,
            detalhes_toner AS "detalhesToner",
            descricao,
            status,
            prioridade,
            atendido_por AS "atendidoPor",
            baixa_estoque_realizada AS "baixaEstoqueRealizada",
            data_abertura AS "dataAbertura",
            data_finalizacao AS "dataFinalizacao",
            historico`,
          [novoStatus, novoDetalhesToner ? JSON.stringify(novoDetalhesToner) : null, JSON.stringify(historico), id]
        );

        return sendJSON(res, 200, updateRes.rows[0]);
      } catch (err) {
        console.error('Erro PUT /api/tickets/:id:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao atualizar chamado.' });
      }
    }

    // DELETE /api/tickets/:id (Excluir chamado por Admin & Desfazer processos/baixa de estoque)
    const deleteTicketMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'DELETE' && deleteTicketMatch) {
      const id = parseInt(deleteTicketMatch[1], 10);
      try {
        // Validar permissão: se houver token enviado, deve ser ADMIN ou SUPER_ADMIN
        const requester = await getRequesterUser(req);
        if (requester && requester.role !== 'ADMIN' && requester.role !== 'SUPER_ADMIN') {
          return sendJSON(res, 403, { error: 'Apenas administradores podem excluir chamados.' });
        }

        const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Chamado não encontrado.' });
        }
        const ticket = ticketRes.rows[0];

        let detalhesToner = ticket.detalhes_toner;
        if (typeof detalhesToner === 'string') {
          try { detalhesToner = JSON.parse(detalhesToner); } catch (e) {}
        }

        let itensEstornados = 0;
        let listaEstornada = [];

        // Se a baixa no estoque foi realizada anteriormente, estornar/devolver cada item ao estoque
        if (ticket.baixa_estoque_realizada && detalhesToner && Array.isArray(detalhesToner.itens)) {
          for (const item of detalhesToner.itens) {
            let tonerRow = null;
            if (item.tonerId) {
              const tRes = await pool.query('SELECT * FROM toners WHERE id = $1', [item.tonerId]);
              if (tRes.rows.length > 0) tonerRow = tRes.rows[0];
            }
            if (!tonerRow && item.marca && item.modelo) {
              const tRes = await pool.query('SELECT * FROM toners WHERE marca = $1 AND modelo = $2', [item.marca, item.modelo]);
              if (tRes.rows.length > 0) tonerRow = tRes.rows[0];
            }
            if (!tonerRow && item.toner) {
              const tRes = await pool.query('SELECT * FROM toners WHERE toner = $1', [item.toner]);
              if (tRes.rows.length > 0) tonerRow = tRes.rows[0];
            }

            if (tonerRow) {
              const isInk = tonerRow.toner.toLowerCase().includes('tank') || tonerRow.toner.toLowerCase().includes('tinta');
              if (!isInk) {
                const qtdDevolver = parseInt(item.quantidadeSolicitada, 10) || 1;
                const novaQtd = tonerRow.quantidade + qtdDevolver;
                const realizarPedido = novaQtd <= tonerRow.estoque_minimo;
                await pool.query(
                  'UPDATE toners SET quantidade = $1, realizar_pedido = $2 WHERE id = $3',
                  [novaQtd, realizarPedido, tonerRow.id]
                );
                itensEstornados += qtdDevolver;
                listaEstornada.push(`${qtdDevolver}x ${tonerRow.toner}`);
              }
            }
          }
        }

        // Excluir chamado da tabela tickets
        await pool.query('DELETE FROM tickets WHERE id = $1', [id]);

        let msg = `Chamado ${ticket.codigo} excluído com sucesso!`;
        if (itensEstornados > 0) {
          msg += ` Estorno no estoque de toners realizado (+${itensEstornados} un: ${listaEstornada.join(', ')}).`;
        }

        return sendJSON(res, 200, {
          message: msg,
          codigo: ticket.codigo,
          itensEstornados
        });
      } catch (err) {
        console.error('Erro DELETE /api/tickets/:id:', err);
        return sendJSON(res, 500, { error: err.message || 'Erro ao excluir chamado.' });
      }
    }
  }

  // ============================================
  // API DE TONERS: /api/toners
  // ============================================
  if (pathname.startsWith('/api/toners')) {
    const subPath = pathname.replace('/api/toners', '');

    // GET /api/toners/stats
    if (method === 'GET' && subPath === '/stats') {
      try {
        const statsRes = await pool.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE quantidade = 0)::int AS zerados,
            COUNT(*) FILTER (WHERE realizar_pedido = true OR quantidade <= estoque_minimo)::int AS criticos,
            COUNT(DISTINCT marca)::int AS marcas
          FROM toners
        `);
        const s = statsRes.rows[0];
        return sendJSON(res, 200, {
          total: s.total || 0,
          zerados: s.zerados || 0,
          criticos: s.criticos || 0,
          marcas: s.marcas || 0
        });
      } catch (err) {
        console.error('Erro /api/toners/stats:', err);
        return sendJSON(res, 500, { error: 'Erro ao obter estatísticas' });
      }
    }

    // GET /api/toners
    if (method === 'GET' && (subPath === '' || subPath === '/')) {
      try {
        const result = await pool.query(`
          SELECT
            id, marca, modelo, toner, quantidade,
            estoque_minimo AS "estoqueMinimo",
            realizar_pedido AS "realizarPedido"
          FROM toners
          ORDER BY id ASC
        `);
        return sendJSON(res, 200, result.rows);
      } catch (err) {
        console.error('Erro GET /api/toners:', err);
        return sendJSON(res, 500, { error: 'Erro ao carregar toners' });
      }
    }

    // GET /api/toners/:id
    const getTonerMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'GET' && getTonerMatch) {
      const id = parseInt(getTonerMatch[1], 10);
      try {
        const result = await pool.query(`
          SELECT
            id, marca, modelo, toner, quantidade,
            estoque_minimo AS "estoqueMinimo",
            realizar_pedido AS "realizarPedido"
          FROM toners WHERE id = $1
        `, [id]);
        if (result.rows.length === 0) return sendJSON(res, 404, { error: 'Toner não encontrado' });
        return sendJSON(res, 200, result.rows[0]);
      } catch (err) {
        console.error('Erro GET /api/toners/:id:', err);
        return sendJSON(res, 500, { error: 'Erro ao buscar toner' });
      }
    }

    // POST /api/toners
    if (method === 'POST' && (subPath === '' || subPath === '/')) {
      try {
        const body = await getRequestBody(req);
        if (!body.marca || !body.modelo || !body.toner) {
          return sendJSON(res, 400, { error: 'Campos marca, modelo e toner são obrigatórios' });
        }
        const insertRes = await pool.query(
          `INSERT INTO toners (marca, modelo, toner, quantidade, estoque_minimo, realizar_pedido)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING
            id, marca, modelo, toner, quantidade,
            estoque_minimo AS "estoqueMinimo",
            realizar_pedido AS "realizarPedido"`,
          [
            String(body.marca).trim(),
            String(body.modelo).trim(),
            String(body.toner).trim(),
            parseInt(body.quantidade) || 0,
            parseInt(body.estoqueMinimo) || 5,
            Boolean(body.realizarPedido)
          ]
        );
        return sendJSON(res, 201, insertRes.rows[0]);
      } catch (err) {
        console.error('Erro POST /api/toners:', err);
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // PUT /api/toners/:id
    const editTonerMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'PUT' && editTonerMatch) {
      const id = parseInt(editTonerMatch[1], 10);
      try {
        const tonerRes = await pool.query('SELECT * FROM toners WHERE id = $1', [id]);
        if (tonerRes.rows.length === 0) return sendJSON(res, 404, { error: 'Toner não encontrado' });
        const current = tonerRes.rows[0];
        const body = await getRequestBody(req);

        const novaMarca = body.marca ? String(body.marca).trim() : current.marca;
        const novoModelo = body.modelo ? String(body.modelo).trim() : current.modelo;
        const novoToner = body.toner ? String(body.toner).trim() : current.toner;
        const novaQtd = typeof body.quantidade !== 'undefined' ? parseInt(body.quantidade) || 0 : current.quantidade;
        const novoEstoqueMin = typeof body.estoqueMinimo !== 'undefined' ? parseInt(body.estoqueMinimo) || 5 : current.estoque_minimo;
        const novoRealizarPed = typeof body.realizarPedido !== 'undefined' ? Boolean(body.realizarPedido) : current.realizar_pedido;

        const updateRes = await pool.query(
          `UPDATE toners
           SET marca = $1, modelo = $2, toner = $3, quantidade = $4, estoque_minimo = $5, realizar_pedido = $6
           WHERE id = $7
           RETURNING
            id, marca, modelo, toner, quantidade,
            estoque_minimo AS "estoqueMinimo",
            realizar_pedido AS "realizarPedido"`,
          [novaMarca, novoModelo, novoToner, novaQtd, novoEstoqueMin, novoRealizarPed, id]
        );

        // Sincronizar modelos que compartilham o mesmo toner
        await pool.query(
          'UPDATE toners SET quantidade = $1, realizar_pedido = $2 WHERE toner = $3',
          [novaQtd, novoRealizarPed, novoToner]
        );

        return sendJSON(res, 200, updateRes.rows[0]);
      } catch (err) {
        console.error('Erro PUT /api/toners/:id:', err);
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // DELETE /api/toners/:id
    const deleteTonerMatch = subPath.match(/^\/(\d+)$/);
    if (method === 'DELETE' && deleteTonerMatch) {
      const id = parseInt(deleteTonerMatch[1], 10);
      try {
        const delRes = await pool.query('DELETE FROM toners WHERE id = $1 RETURNING id', [id]);
        if (delRes.rows.length === 0) return sendJSON(res, 404, { error: 'Toner não encontrado' });
        return sendJSON(res, 204, null);
      } catch (err) {
        console.error('Erro DELETE /api/toners/:id:', err);
        return sendJSON(res, 500, { error: 'Erro ao excluir toner' });
      }
    }
  }

  // ============================================
  // SERVIR ARQUIVOS ESTÁTICOS
  // ============================================
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/login.html';
  }

  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Arquivo não encontrado');
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Sistema de Chamados & Controle de Toners Rodando!`);
    console.log(`🌐 URL Local: http://localhost:${PORT}`);
    console.log(`🔐 Tela de Login: http://localhost:${PORT}/login.html`);
    console.log(`==================================================`);
  });
}

module.exports = server;

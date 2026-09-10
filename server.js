const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const TONERS_FILE = path.join(__dirname, 'toners_backup_49.json');
const USERS_FILE = path.join(__dirname, 'database', 'users.json');
const TICKETS_FILE = path.join(__dirname, 'database', 'tickets.json');
const SALT = 'toners_system_salt_2026';

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

// Ler JSON genérico
function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Erro ao ler ${filePath}:`, err);
  }
  return [];
}

// Salvar JSON genérico
function saveJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Erro ao salvar ${filePath}:`, err);
    return false;
  }
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

      const users = loadJSON(USERS_FILE);
      const hashed = hashPassword(password);

      const user = users.find(u => 
        ((u.login && u.login.toLowerCase() === loginTerm) || (u.email && u.email.toLowerCase() === loginTerm)) && 
        u.passwordHash === hashed
      );

      if (!user) {
        return sendJSON(res, 401, { error: 'Usuário ou senha incorretos.' });
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
      return sendJSON(res, 400, { error: 'Requisição inválida.' });
    }
  }

  // ============================================
  // API DE GESTÃO DE USUÁRIOS: /api/users
  // ============================================
  if (pathname.startsWith('/api/users')) {
    const users = loadJSON(USERS_FILE);
    const subPath = pathname.replace('/api/users', '');

    // GET /api/users
    if (method === 'GET' && (subPath === '' || subPath === '/')) {
      const safeUsers = users.map(u => ({
        id: u.id,
        login: u.login || u.email,
        nome: u.nome,
        email: u.email,
        departamento: u.departamento || (u.role !== 'USUARIO' ? 'TECNOLOGIA' : 'GERAL'),
        role: u.role,
        ativo: u.ativo,
        criadoPor: u.criadoPor,
        dataCriacao: u.dataCriacao
      }));
      return sendJSON(res, 200, safeUsers);
    }

    // POST /api/users (Criar usuário)
    if (method === 'POST' && (subPath === '' || subPath === '/')) {
      try {
        const body = await getRequestBody(req);
        const { login, nome, email, departamento, password, role, criadoPor } = body;

        if (!nome || !email || !password || !role) {
          return sendJSON(res, 400, { error: 'Todos os campos obrigatórios devem ser preenchidos.' });
        }

        const userLogin = (login || email.split('@')[0]).trim();

        // Validar e-mail e login duplicados
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase().trim() || (u.login && u.login.toLowerCase() === userLogin.toLowerCase()))) {
          return sendJSON(res, 400, { error: 'Este e-mail ou nome de usuário já está cadastrado.' });
        }

        // REGRA DE NEGÓCIO RBAC & DEPARTAMENTO:
        // ADMIN só pode criar contas de 'USUARIO'
        const creator = users.find(u => u.email.toLowerCase() === (criadoPor || '').toLowerCase().trim() || (u.login && u.login.toLowerCase() === (criadoPor || '').toLowerCase().trim()));
        if (creator && creator.role === 'ADMIN' && role !== 'USUARIO') {
          return sendJSON(res, 403, { error: 'Administradores só podem criar contas de perfil USUÁRIO.' });
        }

        // Admins pertencem obrigatoriamente ao departamento TECNOLOGIA
        const userDept = (role === 'ADMIN' || role === 'SUPER_ADMIN') ? 'TECNOLOGIA' : (departamento ? String(departamento).trim().toUpperCase() : 'GERAL');

        const maxId = users.reduce((max, u) => (u.id > max ? u.id : max), 0);
        const newUser = {
          id: maxId + 1,
          login: userLogin,
          nome: String(nome).trim(),
          email: String(email).trim().toLowerCase(),
          departamento: userDept,
          passwordHash: hashPassword(password),
          role: role,
          ativo: true,
          criadoPor: criadoPor || 'ADMIN',
          dataCriacao: new Date().toISOString()
        };

        users.push(newUser);
        saveJSON(USERS_FILE, users);

        const { passwordHash, ...safeNewUser } = newUser;
        return sendJSON(res, 201, safeNewUser);
      } catch (err) {
        return sendJSON(res, 400, { error: 'Erro ao criar usuário.' });
      }
    }

    // PUT /api/users/:id (Editar dados do usuário pelo Admin)
    if (method === 'PUT' && subPath.match(/^\/\d+$/)) {
      const id = parseInt(subPath.substring(1), 10);
      const index = users.findIndex(u => u.id === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
      }

      try {
        const body = await getRequestBody(req);
        const user = users[index];

        if (body.nome) user.nome = String(body.nome).trim();
        if (body.email) user.email = String(body.email).trim().toLowerCase();
        if (body.login) user.login = String(body.login).trim();
        if (body.role) user.role = body.role;

        // Se for admin/super_admin, departamento é sempre TECNOLOGIA
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
          user.departamento = 'TECNOLOGIA';
        } else if (body.departamento) {
          user.departamento = String(body.departamento).trim().toUpperCase();
        }

        saveJSON(USERS_FILE, users);

        const { passwordHash, ...safeUser } = user;
        return sendJSON(res, 200, { message: 'Dados do usuário atualizados com sucesso!', user: safeUser });
      } catch (err) {
        return sendJSON(res, 400, { error: 'Erro ao atualizar usuário.' });
      }
    }

    // PUT /api/users/:id/change-password (Alterar Senha)
    if (method === 'PUT' && subPath.match(/^\/\d+\/change-password$/)) {
      const parts = subPath.split('/');
      const id = parseInt(parts[1], 10);
      const userIndex = users.findIndex(u => u.id === id);

      if (userIndex === -1) {
        return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
      }

      try {
        const body = await getRequestBody(req);
        const { newPassword, currentPassword, isAdminReset } = body;

        if (!newPassword || newPassword.length < 4) {
          return sendJSON(res, 400, { error: 'A nova senha deve conter pelo menos 4 caracteres.' });
        }

        if (!isAdminReset) {
          const hashedCurrent = hashPassword(currentPassword || '');
          if (users[userIndex].passwordHash !== hashedCurrent) {
            return sendJSON(res, 400, { error: 'A senha atual informada está incorreta.' });
          }
        }

        users[userIndex].passwordHash = hashPassword(newPassword);
        saveJSON(USERS_FILE, users);

        return sendJSON(res, 200, { message: `Senha do usuário ${users[userIndex].login} alterada com sucesso!` });
      } catch (err) {
        return sendJSON(res, 400, { error: 'Erro ao alterar senha.' });
      }
    }

    // DELETE /api/users/:id
    if (method === 'DELETE' && subPath.match(/^\/\d+$/)) {
      const id = parseInt(subPath.substring(1), 10);
      const index = users.findIndex(u => u.id === id);
      if (index === -1) {
        return sendJSON(res, 404, { error: 'Usuário não encontrado.' });
      }
      if (users[index].role === 'SUPER_ADMIN') {
        return sendJSON(res, 403, { error: 'Não é possível excluir a conta de SUPER_ADMIN principal.' });
      }
      users.splice(index, 1);
      saveJSON(USERS_FILE, users);
      return sendJSON(res, 200, { message: 'Usuário excluído com sucesso.' });
    }
  }

  // ============================================
  // API DE CHAMADOS (TICKETS): /api/tickets
  // ============================================
  if (pathname.startsWith('/api/tickets')) {
    const tickets = loadJSON(TICKETS_FILE);
    const subPath = pathname.replace('/api/tickets', '');

    // GET /api/tickets
    if (method === 'GET' && (subPath === '' || subPath === '/')) {
      return sendJSON(res, 200, tickets);
    }

    // POST /api/tickets (Criar chamado)
    if (method === 'POST' && (subPath === '' || subPath === '/')) {
      try {
        const body = await getRequestBody(req);
        const { solicitanteId, solicitanteNome, solicitanteEmail, solicitanteDepartamento, categoria, detalhesToner, descricao, prioridade } = body;

        if (!solicitanteNome || !categoria || !descricao) {
          return sendJSON(res, 400, { error: 'Solicitante, Categoria e Descrição são obrigatórios.' });
        }

        const maxId = tickets.reduce((max, t) => (t.id > max ? t.id : max), 0);
        const newId = maxId + 1;
        const codigo = `CHM-2026-${String(newId).padStart(4, '0')}`;

        const newTicket = {
          id: newId,
          codigo: codigo,
          solicitanteId: solicitanteId || 0,
          solicitanteNome: String(solicitanteNome).trim(),
          solicitanteEmail: String(solicitanteEmail || '').trim(),
          solicitanteDepartamento: String(solicitanteDepartamento || 'GERAL').toUpperCase(),
          categoria: categoria,
          detalhesToner: detalhesToner || null,
          descricao: String(descricao).trim(),
          status: 'ABERTO',
          prioridade: prioridade || 'NORMAL',
          atendidoPor: null,
          baixaEstoqueRealizada: false,
          dataAbertura: new Date().toISOString(),
          dataFinalizacao: null,
          historico: [
            {
              data: new Date().toISOString(),
              usuario: solicitanteNome,
              acao: 'Chamado aberto no sistema.'
            }
          ]
        };

        tickets.push(newTicket);
        saveJSON(TICKETS_FILE, tickets);
        return sendJSON(res, 201, newTicket);
      } catch (err) {
        return sendJSON(res, 400, { error: 'Erro ao registrar chamado.' });
      }
    }

    // PUT /api/tickets/:id (Atualizar chamado / alteração por admin)
    if (method === 'PUT' && subPath.match(/^\/\d+$/)) {
      const id = parseInt(subPath.substring(1), 10);
      const index = tickets.findIndex(t => t.id === id);
      if (index === -1) {
        return sendJSON(res, 404, { error: 'Chamado não encontrado.' });
      }

      try {
        const body = await getRequestBody(req);
        const ticket = tickets[index];

        if (body.status) {
          ticket.status = body.status;
          ticket.historico.push({
            data: new Date().toISOString(),
            usuario: 'ADMIN',
            acao: `Status alterado para ${body.status}`
          });
        }

        if (body.detalhesToner) {
          ticket.detalhesToner = body.detalhesToner;
          const itensStr = body.detalhesToner.itens ? body.detalhesToner.itens.map(i => `${i.quantidadeSolicitada}x ${i.toner}`).join(', ') : '';
          ticket.historico.push({
            data: new Date().toISOString(),
            usuario: 'ADMIN',
            acao: `Pedido de suprimento alterado pelo Admin: ${body.detalhesToner.modeloImpressora} (${itensStr})`
          });
        } else if (body.newPrinterModel && ticket.detalhesToner) {
          ticket.detalhesToner.modeloImpressora = body.newPrinterModel;
          ticket.historico.push({
            data: new Date().toISOString(),
            usuario: 'ADMIN',
            acao: `Modelo da impressora corrigido para: ${body.newPrinterModel}`
          });
        }

        saveJSON(TICKETS_FILE, tickets);
        return sendJSON(res, 200, ticket);
      } catch (err) {
        return sendJSON(res, 400, { error: 'Erro ao atualizar chamado.' });
      }
    }

    // POST /api/tickets/:id/finalizar (Finalizar chamado & Dar Baixa Automática no Estoque)
    if (method === 'POST' && subPath.match(/^\/\d+\/finalizar$/)) {
      const parts = subPath.split('/');
      const id = parseInt(parts[1], 10);
      const index = tickets.findIndex(t => t.id === id);
      if (index === -1) {
        return sendJSON(res, 404, { error: 'Chamado não encontrado.' });
      }

      const ticket = tickets[index];
      ticket.status = 'FINALIZADO';
      ticket.dataFinalizacao = new Date().toISOString();

      let mensagemEstoque = '';

      if (ticket.categoria === 'Solicitação de Toners e Tintas' && ticket.detalhesToner && ticket.detalhesToner.itens && !ticket.baixaEstoqueRealizada) {
        const toners = loadJSON(TONERS_FILE);
        let itensDescontados = 0;

        ticket.detalhesToner.itens.forEach(item => {
          const tonerInStock = toners.find(t => t.id === item.tonerId || (t.marca === item.marca && t.modelo === item.modelo));
          if (tonerInStock) {
            const isInk = tonerInStock.toner.toLowerCase().includes('tank') || tonerInStock.toner.toLowerCase().includes('tinta');
            if (!isInk) {
              const qtdDesconto = parseInt(item.quantidadeSolicitada) || 1;
              tonerInStock.quantidade = Math.max(0, tonerInStock.quantidade - qtdDesconto);
              tonerInStock.realizarPedido = tonerInStock.quantidade <= tonerInStock.estoqueMinimo;
              itensDescontados += qtdDesconto;
            }
          }
        });

        saveJSON(TONERS_FILE, toners);
        ticket.baixaEstoqueRealizada = true;
        mensagemEstoque = ` Baixa automática no estoque realizada (${itensDescontados} unidade(s)).`;
      }

      ticket.historico.push({
        data: new Date().toISOString(),
        usuario: 'ADMIN',
        acao: `Chamado finalizado.${mensagemEstoque}`
      });

      saveJSON(TICKETS_FILE, tickets);
      return sendJSON(res, 200, { message: `Chamado finalizado com sucesso!${mensagemEstoque}`, ticket });
    }
  }

  // ============================================
  // API DE TONERS: /api/toners...
  // ============================================
  if (pathname.startsWith('/api/toners')) {
    const toners = loadJSON(TONERS_FILE);
    const subPath = pathname.replace('/api/toners', '');

    // GET /api/toners/stats
    if (method === 'GET' && subPath === '/stats') {
      const total = toners.length;
      const zerados = toners.filter(t => t.quantidade === 0).length;
      const criticos = toners.filter(t => t.realizarPedido || t.quantidade <= t.estoqueMinimo).length;
      const marcas = [...new Set(toners.map(t => t.marca))].length;
      return sendJSON(res, 200, { total, zerados, criticos, marcas });
    }

    // GET /api/toners
    if (method === 'GET' && (subPath === '' || subPath === '/')) {
      return sendJSON(res, 200, toners);
    }

    // GET /api/toners/:id
    if (method === 'GET' && subPath.match(/^\/\d+$/)) {
      const id = parseInt(subPath.substring(1), 10);
      const item = toners.find(t => t.id === id);
      if (!item) return sendJSON(res, 404, { error: 'Toner não encontrado' });
      return sendJSON(res, 200, item);
    }

    // POST /api/toners
    if (method === 'POST' && (subPath === '' || subPath === '/')) {
      try {
        const body = await getRequestBody(req);
        if (!body.marca || !body.modelo || !body.toner) {
          return sendJSON(res, 400, { error: 'Campos marca, modelo e toner são obrigatórios' });
        }
        const maxId = toners.reduce((max, t) => (t.id > max ? t.id : max), 0);
        const newItem = {
          id: maxId + 1,
          marca: String(body.marca).trim(),
          modelo: String(body.modelo).trim(),
          toner: String(body.toner).trim(),
          quantidade: parseInt(body.quantidade) || 0,
          estoqueMinimo: parseInt(body.estoqueMinimo) || 5,
          realizarPedido: Boolean(body.realizarPedido),
        };
        toners.push(newItem);
        saveJSON(TONERS_FILE, toners);
        return sendJSON(res, 201, newItem);
      } catch (err) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // PUT /api/toners/:id
    if (method === 'PUT' && subPath.match(/^\/\d+$/)) {
      const id = parseInt(subPath.substring(1), 10);
      const index = toners.findIndex(t => t.id === id);
      if (index === -1) return sendJSON(res, 404, { error: 'Toner não encontrado' });
      try {
        const body = await getRequestBody(req);
        toners[index] = {
          ...toners[index],
          marca: body.marca ? String(body.marca).trim() : toners[index].marca,
          modelo: body.modelo ? String(body.modelo).trim() : toners[index].modelo,
          toner: body.toner ? String(body.toner).trim() : toners[index].toner,
          quantidade: typeof body.quantidade !== 'undefined' ? parseInt(body.quantidade) || 0 : toners[index].quantidade,
          estoqueMinimo: typeof body.estoqueMinimo !== 'undefined' ? parseInt(body.estoqueMinimo) || 5 : toners[index].estoqueMinimo,
          realizarPedido: typeof body.realizarPedido !== 'undefined' ? Boolean(body.realizarPedido) : toners[index].realizarPedido,
        };

        const targetToner = toners[index].toner;
        const targetQty = toners[index].quantidade;
        const targetRealizarPedido = toners[index].realizarPedido;
        toners.forEach(t => {
          if (t.toner === targetToner) {
            t.quantidade = targetQty;
            t.realizarPedido = targetRealizarPedido;
          }
        });

        saveJSON(TONERS_FILE, toners);
        return sendJSON(res, 200, toners[index]);
      } catch (err) {
        return sendJSON(res, 400, { error: 'JSON inválido' });
      }
    }

    // DELETE /api/toners/:id
    if (method === 'DELETE' && subPath.match(/^\/\d+$/)) {
      const id = parseInt(subPath.substring(1), 10);
      const index = toners.findIndex(t => t.id === id);
      if (index === -1) return sendJSON(res, 404, { error: 'Toner não encontrado' });
      toners.splice(index, 1);
      saveJSON(TONERS_FILE, toners);
      return sendJSON(res, 204, null);
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

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Sistema de Chamados & Controle de Toners Rodando!`);
  console.log(`🌐 URL Local: http://localhost:${PORT}`);
  console.log(`🔐 Tela de Login: http://localhost:${PORT}/login.html`);
  console.log(`==================================================`);
});

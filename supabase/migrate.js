const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const idx = line.indexOf("=");
      if (idx !== -1) {
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não definida! Crie o arquivo .env ou defina a variável.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 3
});

function readSafeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.replace(/^\uFEFF/, "");
}

async function run() {
  const client = await pool.connect();
  try {
    console.log("Conectado ao Supabase via Pooler!");
    const schemaSql = readSafeFile(path.join(__dirname, "schema.sql"));
    await client.query(schemaSql);
    console.log("Schema criado (tabelas users, toners, tickets)!");

    const users = JSON.parse(readSafeFile(path.join(__dirname, "..", "database", "users.json")));
    for (const u of users) {
      await client.query(
        "INSERT INTO users (id,login,nome,email,departamento,password_hash,role,ativo,status,criado_por,data_criacao,aprovado_por,data_aprovacao) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (login) DO NOTHING",
        [u.id, u.login||u.email, u.nome, u.email, u.departamento||"GERAL", u.passwordHash, u.role||"USUARIO", u.ativo!==false, u.status||"APROVADO", u.criadoPor||"SISTEMA", u.dataCriacao||new Date().toISOString(), u.aprovadoPor||null, u.dataAprovacao||null]
      );
    }
    await client.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
    console.log(users.length + " usuarios migrados!");

    const toners = JSON.parse(readSafeFile(path.join(__dirname, "..", "toners_backup_49.json")));
    for (const t of toners) {
      await client.query(
        "INSERT INTO toners (id,marca,modelo,toner,quantidade,estoque_minimo,realizar_pedido) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
        [t.id, t.marca, t.modelo, t.toner, t.quantidade||0, t.estoqueMinimo||5, t.realizarPedido||false]
      );
    }
    await client.query("SELECT setval('toners_id_seq', (SELECT MAX(id) FROM toners))");
    console.log(toners.length + " toners migrados!");

    const ticketsFile = path.join(__dirname, "..", "database", "tickets.json");
    let ticketCount = 0;
    if (fs.existsSync(ticketsFile)) {
      const tickets = JSON.parse(readSafeFile(ticketsFile));
      if (Array.isArray(tickets) && tickets.length > 0) {
        for (const t of tickets) {
          await client.query(
            "INSERT INTO tickets (id,codigo,solicitante_id,solicitante_nome,solicitante_email,solicitante_departamento,categoria,detalhes_toner,descricao,status,prioridade,atendido_por,baixa_estoque_realizada,data_abertura,data_finalizacao,historico) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (codigo) DO NOTHING",
            [t.id,t.codigo,t.solicitanteId||0,t.solicitanteNome,t.solicitanteEmail||"",(t.solicitanteDepartamento||"GERAL").toUpperCase(),t.categoria,t.detalhesToner?JSON.stringify(t.detalhesToner):null,t.descricao,t.status||"ABERTO",t.prioridade||"NORMAL",t.atendidoPor||null,t.baixaEstoqueRealizada||false,t.dataAbertura||new Date().toISOString(),t.dataFinalizacao||null,JSON.stringify(t.historico||[])]
          );
          ticketCount++;
        }
        await client.query("SELECT setval('tickets_id_seq', (SELECT MAX(id) FROM tickets))");
      }
    }
    console.log(ticketCount + " chamados migrados!");
    console.log("=== MIGRACAO CONCLUIDA COM SUCESSO! ===");
  } catch (err) {
    console.error("ERRO:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(() => process.exit(1));

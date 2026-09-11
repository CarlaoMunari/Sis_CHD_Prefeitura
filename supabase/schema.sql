-- ============================================================
-- SCHEMA: Sistema de Chamados & Controle de Toners - Guaraci
-- ============================================================

-- Limpar tabelas se existirem (para re-execução segura)
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS toners CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  login          TEXT UNIQUE NOT NULL,
  nome           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  departamento   TEXT NOT NULL DEFAULT 'GERAL',
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'USUARIO'
                   CHECK (role IN ('USUARIO', 'ADMIN', 'SUPER_ADMIN')),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  status         TEXT NOT NULL DEFAULT 'APROVADO'
                   CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
  criado_por     TEXT DEFAULT 'SISTEMA',
  data_criacao   TIMESTAMPTZ DEFAULT NOW(),
  aprovado_por   TEXT DEFAULT NULL,
  data_aprovacao TIMESTAMPTZ DEFAULT NULL
);

-- ============================================================
-- TABELA: toners
-- ============================================================
CREATE TABLE toners (
  id              SERIAL PRIMARY KEY,
  marca           TEXT NOT NULL,
  modelo          TEXT NOT NULL,
  toner           TEXT NOT NULL,
  quantidade      INT NOT NULL DEFAULT 0,
  estoque_minimo  INT NOT NULL DEFAULT 5,
  realizar_pedido BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- TABELA: tickets (chamados)
-- ============================================================
CREATE TABLE tickets (
  id                       SERIAL PRIMARY KEY,
  codigo                   TEXT UNIQUE NOT NULL,
  solicitante_id           INT DEFAULT 0,
  solicitante_nome         TEXT NOT NULL,
  solicitante_email        TEXT DEFAULT '',
  solicitante_departamento TEXT DEFAULT 'GERAL',
  categoria                TEXT NOT NULL,
  detalhes_toner           JSONB DEFAULT NULL,
  descricao                TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'ABERTO'
                             CHECK (status IN ('ABERTO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO')),
  prioridade               TEXT NOT NULL DEFAULT 'NORMAL'
                             CHECK (prioridade IN ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE')),
  atendido_por             TEXT DEFAULT NULL,
  baixa_estoque_realizada  BOOLEAN NOT NULL DEFAULT false,
  data_abertura            TIMESTAMPTZ DEFAULT NOW(),
  data_finalizacao         TIMESTAMPTZ DEFAULT NULL,
  historico                JSONB NOT NULL DEFAULT '[]'::jsonb
);

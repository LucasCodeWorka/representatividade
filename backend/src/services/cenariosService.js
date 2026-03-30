const pool = require('../config/database');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS cenario_simulacoes (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    origem VARCHAR(30) NOT NULL DEFAULT 'manual',
    ano INTEGER NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_cenario_simulacoes_created_at
    ON cenario_simulacoes(created_at DESC);
`;

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function normalizeItem(item = {}) {
  return {
    cd_produto: normalizeNumber(item.cd_produto, 0),
    referencia: normalizeText(item.referencia, ''),
    grupo: normalizeText(item.grupo, '-'),
    descricao: normalizeText(item.descricao, ''),
    cor: normalizeText(item.cor, ''),
    tam: normalizeText(item.tam, ''),
    qt_liquida: normalizeNumber(item.qt_liquida, 0),
    vl_total: normalizeNumber(item.vl_total, 0),
    percent_individual: normalizeNumber(item.percent_individual, 0),
    percent_acumulado: normalizeNumber(item.percent_acumulado, 0),
    classificacao: normalizeText(item.classificacao, '-'),
    suspenso: Boolean(item.suspenso)
  };
}

function normalizeScenario(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items.map(normalizeItem) : [];
  const summary = payload.summary || {};

  return {
    nome: normalizeText(payload.nome, 'Cenario sem nome'),
    origem: normalizeText(payload.origem, 'manual'),
    ano: normalizeNumber(payload.ano, new Date().getFullYear()),
    payload: {
      summary: {
        totalSkus: normalizeNumber(summary.totalSkus, items.length),
        totalQtd: normalizeNumber(summary.totalQtd, items.reduce((sum, item) => sum + item.qt_liquida, 0)),
        totalValor: normalizeNumber(summary.totalValor, items.reduce((sum, item) => sum + item.vl_total, 0)),
        referencias: normalizeNumber(summary.referencias, new Set(items.map((item) => item.referencia).filter(Boolean)).size),
        representatividadePercent: normalizeNumber(summary.representatividadePercent, 0)
      },
      items
    }
  };
}

function mapRow(row) {
  return {
    id: String(row.id),
    nome: row.nome,
    origem: row.origem,
    ano: Number(row.ano),
    summary: row.payload?.summary || {},
    items: Array.isArray(row.payload?.items) ? row.payload.items : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const cenariosService = {
  tableReady: false,
  initError: null,

  unavailableError() {
    if (this.initError) {
      return new Error(`Banco de cenarios indisponivel: ${this.initError}`);
    }
    return new Error('Banco de cenarios indisponivel');
  },

  async ensureTable() {
    if (this.tableReady) return;

    try {
      await pool.query(CREATE_TABLE_SQL);
      this.tableReady = true;
      this.initError = null;
      return;
    } catch (migrationErr) {
      try {
        await pool.query('SELECT 1 FROM cenario_simulacoes LIMIT 1');
        this.tableReady = true;
        this.initError = null;
        console.warn('[CENARIOS] Sem permissao para migracao automatica. Usando tabela existente.');
      } catch (readErr) {
        this.tableReady = false;
        this.initError = readErr.message || migrationErr.message;
        console.error('[CENARIOS] Falha ao inicializar cenario_simulacoes:', this.initError);
      }
    }
  },

  async listScenarios() {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();

    const result = await pool.query(`
      SELECT id, nome, origem, ano, payload, created_at, updated_at
      FROM cenario_simulacoes
      ORDER BY created_at DESC
    `);

    return result.rows.map(mapRow);
  },

  async createScenario(payload) {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();

    const scenario = normalizeScenario(payload);
    const result = await pool.query(
      `
        INSERT INTO cenario_simulacoes (nome, origem, ano, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id, nome, origem, ano, payload, created_at, updated_at
      `,
      [
        scenario.nome,
        scenario.origem,
        scenario.ano,
        JSON.stringify(scenario.payload)
      ]
    );

    return mapRow(result.rows[0]);
  },

  async deleteScenario(id) {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();

    const result = await pool.query('DELETE FROM cenario_simulacoes WHERE id = $1', [Number(id)]);
    if (result.rowCount === 0) {
      throw new Error('Cenario nao encontrado');
    }
  }
};

module.exports = cenariosService;

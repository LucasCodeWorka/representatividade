const pool = require('../config/database');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS retirada_flags (
    id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL,
    stage VARCHAR(20) NOT NULL DEFAULT 'PCP',
    referencia VARCHAR(100),
    cor VARCHAR(100),
    cd_produto BIGINT,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente_diretoria',
    reason TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE retirada_flags
    ADD COLUMN IF NOT EXISTS stage VARCHAR(20) NOT NULL DEFAULT 'PCP';

  ALTER TABLE retirada_flags
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pendente_diretoria';

  UPDATE retirada_flags
  SET status = 'pendente_diretoria'
  WHERE status = 'pendente';

  CREATE INDEX IF NOT EXISTS idx_retirada_flags_status
    ON retirada_flags(status);

  CREATE INDEX IF NOT EXISTS idx_retirada_flags_target
    ON retirada_flags(stage, target_type, referencia, cor, cd_produto);
`;

function normalizeTarget(payload) {
  const normalizeNullableText = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
  };

  const normalizeCdProduto = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  };

  return {
    targetType: payload.targetType,
    stage: payload.stage || 'PCP',
    referencia: normalizeNullableText(payload.referencia),
    cor: normalizeNullableText(payload.cor),
    cd_produto: normalizeCdProduto(payload.cd_produto),
  };
}

function mapRow(row) {
  return {
    id: String(row.id),
    targetType: row.target_type,
    stage: row.stage || 'PCP',
    referencia: row.referencia,
    cor: row.cor,
    cd_produto: row.cd_produto === null ? null : Number(row.cd_produto),
    status: row.status,
    reason: row.reason || '',
    notes: row.notes || '',
    snapshot: row.snapshot || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const flagsService = {
  tableReady: false,
  initError: null,

  unavailableError() {
    if (this.initError) {
      return new Error(`Banco de flags indisponivel: ${this.initError}`);
    }
    return new Error('Banco de flags indisponivel');
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
        await pool.query('SELECT 1 FROM retirada_flags LIMIT 1');
        this.tableReady = true;
        this.initError = null;
        console.warn('[FLAGS] Sem permissao para migracao automatica. Usando tabela retirada_flags existente.');
        return;
      } catch (readErr) {
        this.tableReady = false;
        this.initError = readErr.message || migrationErr.message;
        console.error('[FLAGS] Falha ao inicializar retirada_flags:', this.initError);
      }
    }
  },

  async listFlags() {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();

    const result = await pool.query(`
      SELECT
        id,
        target_type,
        stage,
        referencia,
        cor,
        cd_produto,
        status,
        reason,
        notes,
        snapshot,
        created_at,
        updated_at
      FROM retirada_flags
      ORDER BY created_at DESC
    `);
    return result.rows.map(mapRow);
  },

  async createFlag(payload) {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();
    const target = normalizeTarget(payload);

    console.log('[FLAGS CREATE] Payload recebido:', JSON.stringify({
      targetType: payload.targetType,
      stage: payload.stage,
      referencia: payload.referencia,
      cor: payload.cor,
      cd_produto: payload.cd_produto,
      cd_produto_type: typeof payload.cd_produto
    }));
    console.log('[FLAGS CREATE] Target normalizado:', JSON.stringify(target));

    const existing = await pool.query(
      `
        SELECT
          id,
          target_type,
          stage,
          referencia,
          cor,
          cd_produto,
          status,
          reason,
          notes,
          snapshot,
          created_at,
          updated_at
        FROM retirada_flags
        WHERE target_type = $1
          AND stage = $2
          AND referencia IS NOT DISTINCT FROM $3
          AND cor IS NOT DISTINCT FROM $4
          AND cd_produto IS NOT DISTINCT FROM $5
        LIMIT 1
      `,
      [target.targetType, target.stage, target.referencia, target.cor, target.cd_produto]
    );

    if (existing.rows.length > 0) {
      console.log('[FLAGS CREATE] Flag já existe (id:', existing.rows[0].id, '), atualizando...');
      const updated = await pool.query(
        `
          UPDATE retirada_flags
          SET
            status = $2,
            reason = $3,
            notes = $4,
            snapshot = $5::jsonb,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            target_type,
            stage,
            referencia,
            cor,
            cd_produto,
            status,
            reason,
            notes,
            snapshot,
            created_at,
            updated_at
        `,
        [
          existing.rows[0].id,
          payload.status || existing.rows[0].status || 'pendente_diretoria',
          payload.reason || existing.rows[0].reason || '',
          payload.notes || existing.rows[0].notes || '',
          JSON.stringify(payload.snapshot || existing.rows[0].snapshot || {})
        ]
      );
      const result = mapRow(updated.rows[0]);
      console.log('[FLAGS CREATE] Flag atualizada:', JSON.stringify({ id: result.id, targetType: result.targetType, cd_produto: result.cd_produto }));
      return result;
    }

    console.log('[FLAGS CREATE] Criando nova flag...');
    const inserted = await pool.query(
      `
        INSERT INTO retirada_flags (
          target_type,
          stage,
          referencia,
          cor,
          cd_produto,
          status,
          reason,
          notes,
          snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING
          id,
          target_type,
          stage,
          referencia,
          cor,
          cd_produto,
          status,
          reason,
          notes,
          snapshot,
          created_at,
          updated_at
      `,
      [
        target.targetType,
        target.stage,
        target.referencia,
        target.cor,
        target.cd_produto,
        payload.status || 'pendente_diretoria',
        payload.reason || '',
        payload.notes || '',
        JSON.stringify(payload.snapshot || {})
      ]
    );

    const result = mapRow(inserted.rows[0]);
    console.log('[FLAGS CREATE] Flag criada:', JSON.stringify({ id: result.id, targetType: result.targetType, cd_produto: result.cd_produto }));
    return result;
  },

  async updateFlag(id, payload) {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();

    const result = await pool.query(
      `
        UPDATE retirada_flags
        SET
          status = COALESCE($2, status),
          reason = COALESCE($3, reason),
          notes = COALESCE($4, notes),
          snapshot = COALESCE($5::jsonb, snapshot),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          target_type,
          stage,
          referencia,
          cor,
          cd_produto,
          status,
          reason,
          notes,
          snapshot,
          created_at,
          updated_at
      `,
      [
        Number(id),
        payload.status || null,
        payload.reason !== undefined ? payload.reason : null,
        payload.notes !== undefined ? payload.notes : null,
        payload.snapshot ? JSON.stringify(payload.snapshot) : null
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Flag nao encontrada');
    }

    return mapRow(result.rows[0]);
  },

  async deleteFlag(id) {
    await this.ensureTable();
    if (!this.tableReady) throw this.unavailableError();

    const result = await pool.query('DELETE FROM retirada_flags WHERE id = $1', [Number(id)]);
    if (result.rowCount === 0) {
      throw new Error('Flag nao encontrada');
    }
  }
};

module.exports = flagsService;

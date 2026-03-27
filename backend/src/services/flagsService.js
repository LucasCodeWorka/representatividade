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
  return {
    targetType: payload.targetType,
    stage: payload.stage || 'PCP',
    referencia: payload.referencia || null,
    cor: payload.cor || null,
    cd_produto: payload.cd_produto ?? null,
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

  async ensureTable() {
    if (this.tableReady) return;
    await pool.query(CREATE_TABLE_SQL);
    this.tableReady = true;
  },

  async listFlags() {
    await this.ensureTable();
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
    const target = normalizeTarget(payload);

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
      return mapRow(updated.rows[0]);
    }

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

    return mapRow(inserted.rows[0]);
  },

  async updateFlag(id, payload) {
    await this.ensureTable();
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
    const result = await pool.query('DELETE FROM retirada_flags WHERE id = $1', [Number(id)]);
    if (result.rowCount === 0) {
      throw new Error('Flag nao encontrada');
    }
  }
};

module.exports = flagsService;

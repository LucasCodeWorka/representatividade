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

CREATE INDEX IF NOT EXISTS idx_retirada_flags_status
  ON retirada_flags(status);

CREATE INDEX IF NOT EXISTS idx_retirada_flags_target
  ON retirada_flags(stage, target_type, referencia, cor, cd_produto);

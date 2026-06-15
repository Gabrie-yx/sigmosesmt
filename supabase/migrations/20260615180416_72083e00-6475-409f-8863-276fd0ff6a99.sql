
ALTER TABLE public.ptes
  ADD COLUMN IF NOT EXISTS tipo_pt text NOT NULL DEFAULT 'PTE',
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time,
  ADD COLUMN IF NOT EXISTS validade_tipo text NOT NULL DEFAULT 'TURNO',
  ADD COLUMN IF NOT EXISTS validade_ate timestamptz,
  ADD COLUMN IF NOT EXISTS pts_relacionadas uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS emergencia_sem_apr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergencia_justificativa text;

CREATE INDEX IF NOT EXISTS idx_ptes_tipo_pt ON public.ptes(tipo_pt);
CREATE INDEX IF NOT EXISTS idx_ptes_validade_ate ON public.ptes(validade_ate);


ALTER TABLE public.employee_saidas_expediente
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'AUTORIZADA',
  ADD COLUMN IF NOT EXISTS decisao_portaria_at timestamptz,
  ADD COLUMN IF NOT EXISTS decisao_portaria_por uuid,
  ADD COLUMN IF NOT EXISTS decisao_motivo text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_saidas_expediente_status_chk'
  ) THEN
    ALTER TABLE public.employee_saidas_expediente
      ADD CONSTRAINT employee_saidas_expediente_status_chk
      CHECK (status IN ('AUTORIZADA','VALIDADA','INDEFERIDA','CANCELADA'));
  END IF;
END $$;

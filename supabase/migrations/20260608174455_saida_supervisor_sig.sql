ALTER TABLE public.employee_saidas_expediente
  ADD COLUMN IF NOT EXISTS assinatura_supervisor text,
  ADD COLUMN IF NOT EXISTS assinado_supervisor_por uuid,
  ADD COLUMN IF NOT EXISTS assinado_supervisor_em timestamptz;

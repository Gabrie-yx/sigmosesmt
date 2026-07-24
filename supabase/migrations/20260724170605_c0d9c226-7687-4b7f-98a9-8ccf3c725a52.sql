ALTER TABLE public.cipa_gestoes
  ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'COMISSAO' CHECK (modo IN ('DESIGNADO','COMISSAO')),
  ADD COLUMN IF NOT EXISTS grau_risco SMALLINT CHECK (grau_risco BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS designado_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designado_termo_data DATE,
  ADD COLUMN IF NOT EXISTS designado_termo_url TEXT,
  ADD COLUMN IF NOT EXISTS designado_treinamento_horas NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS designado_treinamento_data DATE,
  ADD COLUMN IF NOT EXISTS assedio_canal_url TEXT;
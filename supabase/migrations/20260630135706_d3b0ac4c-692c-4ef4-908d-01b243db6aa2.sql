ALTER TABLE public.employee_docs
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS data_validade date,
  ADD COLUMN IF NOT EXISTS sem_validade boolean NOT NULL DEFAULT false;

-- Fase 1: Vínculo trabalhista (AVULSO + campos condicionais MEI/AVULSO)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS mei_contrato_numero TEXT,
  ADD COLUMN IF NOT EXISTS mei_contrato_validade DATE,
  ADD COLUMN IF NOT EXISTS avulso_ogmo_matricula TEXT,
  ADD COLUMN IF NOT EXISTS avulso_sindicato TEXT;

-- Trava de consistência: tipo_cadastro permitido
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_tipo_cadastro_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_tipo_cadastro_check
  CHECK (tipo_cadastro IN ('NAO_MEI','MEI','AVULSO','TERCEIRIZADO'));

COMMENT ON COLUMN public.employees.tipo_cadastro IS
  'Vínculo trabalhista: NAO_MEI = CLT carteira assinada; MEI = PJ contratado; AVULSO = trabalhador portuário/OGMO sem vínculo fixo; TERCEIRIZADO = CLT de empresa terceira (responsabilidade solidária da contratante).';

COMMENT ON COLUMN public.employees.mei_contrato_numero IS 'Número do contrato PJ (obrigatório para MEI)';
COMMENT ON COLUMN public.employees.mei_contrato_validade IS 'Validade do contrato PJ (MEI)';
COMMENT ON COLUMN public.employees.avulso_ogmo_matricula IS 'Matrícula OGMO/sindicato (AVULSO)';
COMMENT ON COLUMN public.employees.avulso_sindicato IS 'Sindicato de origem (AVULSO)';

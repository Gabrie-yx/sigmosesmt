
-- ============================================================
-- FRENTE 1: Renomear NAO_MEI -> CLT
-- ============================================================

-- 1. Remove CHECK antigo (que não permite CLT)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_tipo_cadastro_check;

-- 2. Atualiza registros existentes
UPDATE public.employees SET tipo_cadastro='CLT' WHERE tipo_cadastro='NAO_MEI';

-- 3. Novo CHECK
ALTER TABLE public.employees ADD CONSTRAINT employees_tipo_cadastro_check
  CHECK (tipo_cadastro IN ('MEI','CLT','AVULSO'));

-- 4. Novo default
ALTER TABLE public.employees ALTER COLUMN tipo_cadastro SET DEFAULT 'AVULSO';

-- 5. Trigger BEFORE INSERT: default inteligente por empresa
CREATE OR REPLACE FUNCTION public.employees_default_tipo_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_type text;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.tipo_cadastro IS NULL OR NEW.tipo_cadastro = 'AVULSO') THEN
    IF NEW.company_id IS NOT NULL THEN
      SELECT type INTO v_company_type FROM public.companies WHERE id = NEW.company_id;
      IF v_company_type = 'CLT' THEN
        NEW.tipo_cadastro := 'MEI';
      ELSE
        NEW.tipo_cadastro := 'AVULSO';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_default_tipo_cadastro ON public.employees;
CREATE TRIGGER trg_employees_default_tipo_cadastro
BEFORE INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employees_default_tipo_cadastro();


-- ============================================================
-- FRENTE 3.1: Histórico de transferências entre empresas
-- ============================================================
CREATE TABLE public.employee_company_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  empresa_antiga_id uuid REFERENCES public.companies(id),
  empresa_nova_id uuid NOT NULL REFERENCES public.companies(id),
  transferido_em timestamptz NOT NULL DEFAULT now(),
  transferido_por uuid REFERENCES auth.users(id),
  motivo text NOT NULL,
  aprs_reatribuidas integer DEFAULT 0,
  aprs_arquivadas integer DEFAULT 0,
  ptes_reatribuidas integer DEFAULT 0,
  ptes_arquivadas integer DEFAULT 0,
  ghe_alerta text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.employee_company_history TO authenticated;
GRANT ALL ON public.employee_company_history TO service_role;

ALTER TABLE public.employee_company_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated leem historico transferencias"
ON public.employee_company_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/moderador inserem historico transferencias"
ON public.employee_company_history FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderador'::app_role)
);

CREATE INDEX idx_employee_company_history_employee
  ON public.employee_company_history(employee_id, transferido_em DESC);


-- ============================================================
-- Colunas de cancelamento por transferência em APR e PTE
-- ============================================================
ALTER TABLE public.aprs
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_motivo text,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid REFERENCES auth.users(id);

ALTER TABLE public.ptes
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_motivo text,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid REFERENCES auth.users(id);

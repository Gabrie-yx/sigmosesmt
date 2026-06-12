-- 1) Campo "atividades" no cargo (default pra profissiografia do PPP)
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS atividades TEXT;

COMMENT ON COLUMN public.roles.atividades IS 'Descrição padrão das atividades do cargo — usada como default no campo Profissiografia (14.2) do PPP';

-- 2) Função pra gerar número sequencial anual do PPP (PPP-NNN/AAAA)
CREATE OR REPLACE FUNCTION public.gerar_numero_ppp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(substring(numero from '^PPP-(\d+)/')::INT), 0) + 1
    INTO v_seq
    FROM public.ppp_emissoes
   WHERE numero ~ ('^PPP-\d+/' || v_ano || '$');
  RETURN 'PPP-' || lpad(v_seq::TEXT, 3, '0') || '/' || v_ano;
END;
$$;

-- 3) Tabela de emissões do PPP
CREATE TABLE IF NOT EXISTS public.ppp_emissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  numero TEXT,
  versao INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','EMITIDO','CANCELADO')),
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  data_emissao DATE,
  emitido_em TIMESTAMPTZ,
  emitido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelado_em TIMESTAMPTZ,
  cancelado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo_cancelamento TEXT,
  pdf_path TEXT,
  pdf_hash TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ppp_emissoes_employee_idx ON public.ppp_emissoes(employee_id);
CREATE INDEX IF NOT EXISTS ppp_emissoes_status_idx ON public.ppp_emissoes(status);
CREATE INDEX IF NOT EXISTS ppp_emissoes_numero_idx ON public.ppp_emissoes(numero) WHERE numero IS NOT NULL;

-- 4) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_emissoes TO authenticated;
GRANT ALL ON public.ppp_emissoes TO service_role;

-- 5) RLS
ALTER TABLE public.ppp_emissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppp_emissoes_select_autenticado"
  ON public.ppp_emissoes
  FOR SELECT
  TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "ppp_emissoes_insert_editor"
  ON public.ppp_emissoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "ppp_emissoes_update_editor_se_rascunho_ou_admin"
  ON public.ppp_emissoes
  FOR UPDATE
  TO authenticated
  USING (
    (status = 'RASCUNHO' AND public.is_editor(auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.is_editor(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "ppp_emissoes_delete_admin"
  ON public.ppp_emissoes
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6) Trigger pra auto-gerar número quando muda pra EMITIDO + updated_at
CREATE OR REPLACE FUNCTION public.ppp_emissoes_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'EMITIDO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'EMITIDO') THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := public.gerar_numero_ppp();
    END IF;
    IF NEW.emitido_em IS NULL THEN NEW.emitido_em := now(); END IF;
    IF NEW.emitido_por IS NULL THEN NEW.emitido_por := auth.uid(); END IF;
    IF NEW.data_emissao IS NULL THEN NEW.data_emissao := CURRENT_DATE; END IF;
  END IF;
  IF NEW.status = 'CANCELADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'CANCELADO') THEN
    IF NEW.cancelado_em IS NULL THEN NEW.cancelado_em := now(); END IF;
    IF NEW.cancelado_por IS NULL THEN NEW.cancelado_por := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppp_emissoes_before_write ON public.ppp_emissoes;
CREATE TRIGGER trg_ppp_emissoes_before_write
  BEFORE INSERT OR UPDATE ON public.ppp_emissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.ppp_emissoes_before_write();
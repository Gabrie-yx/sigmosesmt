
CREATE TABLE public.relatorios_investigacao_acidente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acidente_id UUID NOT NULL REFERENCES public.acidentes_trabalho(id) ON DELETE CASCADE,
  numero TEXT,
  ano INT NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE)::INT,
  dados_gerais JSONB NOT NULL DEFAULT '{}'::jsonb,
  enquadramento JSONB NOT NULL DEFAULT '{}'::jsonb,
  porques JSONB NOT NULL DEFAULT '[]'::jsonb,
  acoes_imediatas JSONB NOT NULL DEFAULT '[]'::jsonb,
  plano_acao JSONB NOT NULL DEFAULT '[]'::jsonb,
  participantes JSONB NOT NULL DEFAULT '[]'::jsonb,
  assinaturas JSONB NOT NULL DEFAULT '{}'::jsonb,
  fotos_local JSONB NOT NULL DEFAULT '[]'::jsonb,
  fotos_lesao JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_riacd_acidente ON public.relatorios_investigacao_acidente(acidente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_investigacao_acidente TO authenticated;
GRANT ALL ON public.relatorios_investigacao_acidente TO service_role;

ALTER TABLE public.relatorios_investigacao_acidente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RIA select autenticado" ON public.relatorios_investigacao_acidente
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "RIA insert editor" ON public.relatorios_investigacao_acidente
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "RIA update editor" ON public.relatorios_investigacao_acidente
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "RIA delete moderator" ON public.relatorios_investigacao_acidente
  FOR DELETE TO authenticated USING (public.is_moderator(auth.uid()));

CREATE TRIGGER trg_ria_updated BEFORE UPDATE ON public.relatorios_investigacao_acidente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gerar_numero_ria()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(substring(numero from '^RIA-(\d+)/')::INT), 0) + 1
    INTO v_seq
    FROM public.relatorios_investigacao_acidente
   WHERE numero ~ ('^RIA-\d+/' || v_ano || '$');
  RETURN 'RIA-' || lpad(v_seq::TEXT, 3, '0') || '/' || v_ano;
END;
$$;

CREATE OR REPLACE FUNCTION public.ria_set_numero()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_ria();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ria_numero BEFORE INSERT ON public.relatorios_investigacao_acidente
  FOR EACH ROW EXECUTE FUNCTION public.ria_set_numero();

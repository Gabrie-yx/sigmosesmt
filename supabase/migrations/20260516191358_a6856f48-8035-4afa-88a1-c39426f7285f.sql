-- Campos formais do TNC (FORCP-SGI-05) para nao_conformidades
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS emitente TEXT,
  ADD COLUMN IF NOT EXISTS departamento TEXT,
  ADD COLUMN IF NOT EXISTS enviado_para TEXT,
  ADD COLUMN IF NOT EXISTS classificacao TEXT DEFAULT 'Não Conformidade',
  ADD COLUMN IF NOT EXISTS requisito TEXT,
  ADD COLUMN IF NOT EXISTS norma TEXT DEFAULT 'ISO 9001:2015',
  ADD COLUMN IF NOT EXISTS reincidente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS abrangencia TEXT,
  ADD COLUMN IF NOT EXISTS porques JSONB DEFAULT '{"p1":"","p2":"","p3":"","p4":"","p5":""}'::jsonb,
  ADD COLUMN IF NOT EXISTS acoes_imediatas_lista JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acoes_corretivas_lista JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acoes_implementadas BOOLEAN,
  ADD COLUMN IF NOT EXISTS data_implementacao DATE,
  ADD COLUMN IF NOT EXISTS comentarios_implementacao TEXT,
  ADD COLUMN IF NOT EXISTS novo_prazo DATE,
  ADD COLUMN IF NOT EXISTS prazo_verificacao_eficacia DATE,
  ADD COLUMN IF NOT EXISTS eficaz BOOLEAN,
  ADD COLUMN IF NOT EXISTS comentarios_eficacia TEXT,
  ADD COLUMN IF NOT EXISTS data_fechamento DATE,
  ADD COLUMN IF NOT EXISTS responsavel_fechamento TEXT,
  ADD COLUMN IF NOT EXISTS pendencia_origem TEXT;

-- Gerador automático de número TNC (sequencial anual)
CREATE OR REPLACE FUNCTION public.gerar_numero_tnc()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(substring(numero from '^TNC-(\d+)/')::INT), 0) + 1
    INTO v_seq
    FROM public.nao_conformidades
   WHERE numero ~ ('^TNC-\d+/' || v_ano || '$');
  RETURN 'TNC-' || lpad(v_seq::TEXT, 3, '0') || '/' || v_ano;
END;
$$;

-- Trigger pra preencher número automaticamente
CREATE OR REPLACE FUNCTION public.set_numero_nc()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_tnc();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_numero_nc ON public.nao_conformidades;
CREATE TRIGGER trg_set_numero_nc
  BEFORE INSERT ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_nc();
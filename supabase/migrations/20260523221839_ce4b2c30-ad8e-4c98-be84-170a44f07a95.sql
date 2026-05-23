
-- 1. Novos campos em plano_acoes
ALTER TABLE public.plano_acoes
  ADD COLUMN IF NOT EXISTS origem_acao TEXT,
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT NOT NULL DEFAULT 'ACAO_CORRETIVA',
  ADD COLUMN IF NOT EXISTS responsavel_execucao TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_validacao_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_verificacao_eficacia TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_eficacia TEXT,
  ADD COLUMN IF NOT EXISTS eficacia_observacao TEXT,
  ADD COLUMN IF NOT EXISTS eficacia_validada_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eficacia_validada_em TIMESTAMPTZ;

ALTER TABLE public.plano_acoes
  DROP CONSTRAINT IF EXISTS plano_acoes_tipo_registro_chk;
ALTER TABLE public.plano_acoes
  ADD CONSTRAINT plano_acoes_tipo_registro_chk
  CHECK (tipo_registro IN ('ACAO_CORRETIVA','MELHORIA'));

ALTER TABLE public.plano_acoes
  DROP CONSTRAINT IF EXISTS plano_acoes_origem_chk;
ALTER TABLE public.plano_acoes
  ADD CONSTRAINT plano_acoes_origem_chk
  CHECK (origem_acao IS NULL OR origem_acao IN ('AUDITORIA','INSPECAO_SST','QUASE_ACIDENTE','CIPA','PGR_APR','CHECKLIST','OUTRO'));

ALTER TABLE public.plano_acoes
  DROP CONSTRAINT IF EXISTS plano_acoes_status_eficacia_chk;
ALTER TABLE public.plano_acoes
  ADD CONSTRAINT plano_acoes_status_eficacia_chk
  CHECK (status_eficacia IS NULL OR status_eficacia IN ('PENDENTE','EFICAZ','INEFICAZ'));

-- 2. Campo análise de causa em NCs
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS analise_causa TEXT;

-- 3. Trigger: ao concluir, calcula data de verificação de eficácia
CREATE OR REPLACE FUNCTION public.plano_acoes_set_eficacia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias INT;
BEGIN
  -- Quando muda para CONCLUIDA e ainda não tem verificação agendada
  IF NEW.status = 'CONCLUIDA' AND (OLD.status IS DISTINCT FROM 'CONCLUIDA') THEN
    v_dias := CASE UPPER(COALESCE(NEW.prioridade,'MEDIA'))
      WHEN 'ALTA' THEN 15
      WHEN 'CRITICA' THEN 15
      WHEN 'BAIXA' THEN 60
      ELSE 30
    END;
    IF NEW.data_verificacao_eficacia IS NULL THEN
      NEW.data_verificacao_eficacia := now() + (v_dias || ' days')::INTERVAL;
    END IF;
    IF NEW.status_eficacia IS NULL THEN
      NEW.status_eficacia := 'PENDENTE';
    END IF;
    IF NEW.data_conclusao IS NULL THEN
      NEW.data_conclusao := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plano_acoes_set_eficacia ON public.plano_acoes;
CREATE TRIGGER trg_plano_acoes_set_eficacia
  BEFORE UPDATE ON public.plano_acoes
  FOR EACH ROW EXECUTE FUNCTION public.plano_acoes_set_eficacia();

-- 4. Trigger: auto-preenche origem_acao quando vinculada a NC
CREATE OR REPLACE FUNCTION public.plano_acoes_auto_origem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_nc TEXT;
BEGIN
  IF NEW.origem_acao IS NULL AND NEW.nc_id IS NOT NULL THEN
    SELECT origem INTO v_origem_nc FROM public.nao_conformidades WHERE id = NEW.nc_id;
    IF v_origem_nc IS NOT NULL THEN
      NEW.origem_acao := CASE v_origem_nc
        WHEN 'AUDITORIA' THEN 'AUDITORIA'
        WHEN 'AUDITORIA_INTERNA' THEN 'AUDITORIA'
        WHEN 'AUDITORIA_EXTERNA' THEN 'AUDITORIA'
        WHEN 'INSPECAO' THEN 'INSPECAO_SST'
        WHEN 'INSPECAO_SST' THEN 'INSPECAO_SST'
        WHEN 'QUASE_ACIDENTE' THEN 'QUASE_ACIDENTE'
        WHEN 'CIPA' THEN 'CIPA'
        WHEN 'PGR' THEN 'PGR_APR'
        WHEN 'APR' THEN 'PGR_APR'
        WHEN 'CHECKLIST_EQUIPAMENTO' THEN 'CHECKLIST'
        ELSE 'OUTRO'
      END;
    END IF;
  END IF;
  IF NEW.origem_acao IS NULL AND NEW.incidente_id IS NOT NULL THEN
    NEW.origem_acao := 'QUASE_ACIDENTE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plano_acoes_auto_origem ON public.plano_acoes;
CREATE TRIGGER trg_plano_acoes_auto_origem
  BEFORE INSERT ON public.plano_acoes
  FOR EACH ROW EXECUTE FUNCTION public.plano_acoes_auto_origem();

-- 5. RPC para validar eficácia (admin/moderador)
CREATE OR REPLACE FUNCTION public.validar_eficacia_acao(
  _id UUID,
  _eficaz BOOLEAN,
  _obs TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_moderator(v_user) THEN
    RAISE EXCEPTION 'Apenas administradores e moderadores podem validar eficácia';
  END IF;

  UPDATE public.plano_acoes
     SET status_eficacia = CASE WHEN _eficaz THEN 'EFICAZ' ELSE 'INEFICAZ' END,
         eficacia_observacao = _obs,
         eficacia_validada_por = v_user,
         eficacia_validada_em = now(),
         updated_at = now()
   WHERE id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada';
  END IF;
END;
$$;

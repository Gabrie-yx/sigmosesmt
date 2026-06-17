
-- Desligamento de funcionários: campos, trigger e RPC
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS data_desligamento date,
  ADD COLUMN IF NOT EXISTS motivo_desligamento text,
  ADD COLUMN IF NOT EXISTS desligamento_observacoes text,
  ADD COLUMN IF NOT EXISTS desligado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS desligamento_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Trigger: ao marcar DESLIGADO, cancela OSs ativas e cria bloqueio global
CREATE OR REPLACE FUNCTION public.employee_on_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
BEGIN
  IF NEW.status = 'DESLIGADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'DESLIGADO') THEN
    IF NEW.data_desligamento IS NULL THEN
      NEW.data_desligamento := CURRENT_DATE;
    END IF;
    IF NEW.desligado_por IS NULL THEN
      NEW.desligado_por := v_user;
    END IF;

    -- Substituir OSs ativas
    UPDATE public.oss_emissoes
       SET status = 'SUBSTITUIDO', updated_at = now()
     WHERE employee_id = NEW.id
       AND status IN ('PENDENTE_ASSINATURA','ASSINADO');

    -- Bloqueio global de segurança (impede novas emissões/atividades)
    IF v_user IS NOT NULL THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user;
    END IF;
    INSERT INTO public.safety_overrides (
      employee_id, scope, item_key, justificativa,
      liberado_por, liberado_por_email, liberado_em, ativo
    ) VALUES (
      NEW.id, 'GLOBAL', NULL,
      'Funcionário desligado em ' || to_char(NEW.data_desligamento,'DD/MM/YYYY')
        || COALESCE(' — ' || NEW.motivo_desligamento, '')
        || '. Bloqueio permanente.',
      v_user, v_email, now(), true
    );
  END IF;

  -- Reativação: revoga bloqueios de desligamento
  IF TG_OP = 'UPDATE' AND OLD.status = 'DESLIGADO' AND NEW.status <> 'DESLIGADO' THEN
    UPDATE public.safety_overrides
       SET ativo = false,
           revogado_em = now(),
           revogado_por = v_user,
           motivo_revogacao = 'Funcionário reativado'
     WHERE employee_id = NEW.id
       AND scope = 'GLOBAL'
       AND ativo = true
       AND justificativa LIKE 'Funcionário desligado em%';
    NEW.data_desligamento := NULL;
    NEW.motivo_desligamento := NULL;
    NEW.desligado_por := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_on_desligamento ON public.employees;
CREATE TRIGGER trg_employee_on_desligamento
  BEFORE UPDATE OR INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employee_on_desligamento();

-- RPC para registrar desligamento de forma atômica
CREATE OR REPLACE FUNCTION public.registrar_desligamento_funcionario(
  _employee_id uuid,
  _data_desligamento date,
  _motivo text,
  _observacoes text DEFAULT NULL,
  _checklist jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para registrar desligamento';
  END IF;
  IF _data_desligamento IS NULL OR _data_desligamento > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de desligamento inválida';
  END IF;

  UPDATE public.employees
     SET status = 'DESLIGADO',
         data_desligamento = _data_desligamento,
         motivo_desligamento = _motivo,
         desligamento_observacoes = _observacoes,
         desligamento_checklist = COALESCE(_checklist, '{}'::jsonb),
         desligado_por = v_user,
         updated_at = now()
   WHERE id = _employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_desligamento_funcionario(uuid,date,text,text,jsonb) TO authenticated;

-- Reativar funcionário
CREATE OR REPLACE FUNCTION public.reativar_funcionario(_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.employees SET status = 'ATIVO', updated_at = now() WHERE id = _employee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reativar_funcionario(uuid) TO authenticated;

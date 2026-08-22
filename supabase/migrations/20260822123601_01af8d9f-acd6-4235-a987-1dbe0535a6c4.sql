ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVA',
  ADD COLUMN IF NOT EXISTS data_desativacao date,
  ADD COLUMN IF NOT EXISTS motivo_desativacao text,
  ADD COLUMN IF NOT EXISTS data_reativacao date,
  ADD COLUMN IF NOT EXISTS motivo_reativacao text;

CREATE OR REPLACE FUNCTION public.recalcular_status_empresa(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ativos int;
  _atual text;
BEGIN
  IF _company_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO _ativos
  FROM public.employees
  WHERE company_id = _company_id AND status = 'ATIVO';

  SELECT status INTO _atual FROM public.companies WHERE id = _company_id;
  IF _atual IS NULL THEN RETURN; END IF;

  IF _ativos = 0 AND _atual <> 'DESATIVADA' THEN
    UPDATE public.companies
       SET status = 'DESATIVADA',
           data_desativacao = CURRENT_DATE,
           motivo_desativacao = COALESCE(motivo_desativacao, 'Sem efetivo ativo (automático)'),
           updated_at = now()
     WHERE id = _company_id;
  ELSIF _ativos > 0 AND _atual <> 'ATIVA' THEN
    UPDATE public.companies
       SET status = 'ATIVA',
           data_reativacao = CURRENT_DATE,
           motivo_reativacao = COALESCE(motivo_reativacao, 'Reativada automaticamente (efetivo ativo)'),
           data_desativacao = NULL,
           motivo_desativacao = NULL,
           updated_at = now()
     WHERE id = _company_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_employees_status_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_status_empresa(OLD.company_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    PERFORM public.recalcular_status_empresa(OLD.company_id);
  END IF;

  PERFORM public.recalcular_status_empresa(NEW.company_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_status_empresa ON public.employees;
CREATE TRIGGER employees_status_empresa
AFTER INSERT OR UPDATE OF status, company_id OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.trg_employees_status_empresa();

CREATE OR REPLACE FUNCTION public.desativar_empresa(_company_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ativos int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador')) THEN
    RAISE EXCEPTION 'Sem permissão para desativar empresa';
  END IF;
  SELECT count(*) INTO _ativos FROM public.employees WHERE company_id = _company_id AND status = 'ATIVO';
  IF _ativos > 0 THEN
    RAISE EXCEPTION 'Empresa possui % funcionário(s) ativo(s). Desligue-os antes de desativar.', _ativos;
  END IF;
  UPDATE public.companies
     SET status = 'DESATIVADA',
         data_desativacao = CURRENT_DATE,
         motivo_desativacao = COALESCE(NULLIF(trim(_motivo), ''), 'Encerramento de atividades'),
         updated_at = now()
   WHERE id = _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reativar_empresa(_company_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador')) THEN
    RAISE EXCEPTION 'Sem permissão para reativar empresa';
  END IF;
  IF coalesce(length(trim(_motivo)), 0) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 5 caracteres)';
  END IF;
  UPDATE public.companies
     SET status = 'ATIVA',
         data_reativacao = CURRENT_DATE,
         motivo_reativacao = trim(_motivo),
         data_desativacao = NULL,
         motivo_desativacao = NULL,
         updated_at = now()
   WHERE id = _company_id;
END;
$$;

-- Sincroniza estado atual de todas as empresas
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.recalcular_status_empresa(r.id);
  END LOOP;
END $$;
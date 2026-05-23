CREATE OR REPLACE FUNCTION public.auto_fechar_nc_se_eficaz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_eficazes INT;
  v_status TEXT;
BEGIN
  IF NEW.nc_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status_eficacia IS DISTINCT FROM 'EFICAZ' THEN RETURN NEW; END IF;
  IF OLD.status_eficacia IS NOT DISTINCT FROM NEW.status_eficacia THEN RETURN NEW; END IF;

  SELECT status INTO v_status FROM public.nao_conformidades WHERE id = NEW.nc_id;
  IF v_status IN ('FECHADA','CANCELADA') THEN RETURN NEW; END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status_eficacia = 'EFICAZ' AND status = 'CONCLUIDA')
    INTO v_total, v_eficazes
    FROM public.plano_acoes
   WHERE nc_id = NEW.nc_id;

  IF v_total > 0 AND v_total = v_eficazes THEN
    UPDATE public.nao_conformidades
       SET status = 'FECHADA',
           eficaz = true,
           data_fechamento = COALESCE(data_fechamento, now()),
           responsavel_fechamento = COALESCE(responsavel_fechamento, NEW.eficacia_validada_por),
           updated_at = now()
     WHERE id = NEW.nc_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fechar_nc_se_eficaz ON public.plano_acoes;
CREATE TRIGGER trg_auto_fechar_nc_se_eficaz
AFTER UPDATE OF status_eficacia ON public.plano_acoes
FOR EACH ROW
EXECUTE FUNCTION public.auto_fechar_nc_se_eficaz();
CREATE OR REPLACE FUNCTION public.validar_inspecao_publicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fotos integer;
  v_ncs integer;
  v_ncs_sem_plano integer;
BEGIN
  IF NEW.status = 'publicada' AND (
    TG_OP = 'INSERT'
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.publicada_em IS DISTINCT FROM NEW.publicada_em
  ) THEN
    SELECT count(*) INTO v_fotos
    FROM public.inspecao_fotos
    WHERE inspecao_id = NEW.id;

    IF v_fotos = 0 THEN
      RAISE EXCEPTION 'Antes de publicar, anexe ao menos uma evidência fotográfica.' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_ncs
    FROM public.inspecao_ncs
    WHERE inspecao_id = NEW.id;

    IF v_ncs = 0 THEN
      RAISE EXCEPTION 'Antes de publicar, registre ao menos uma não conformidade vinculada à inspeção.' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_ncs_sem_plano
    FROM public.inspecao_ncs n
    WHERE n.inspecao_id = NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.inspecao_ncs_planos p
        WHERE p.nc_id = n.id
      );

    IF v_ncs_sem_plano > 0 THEN
      RAISE EXCEPTION 'Antes de publicar, cada NC precisa ter pelo menos uma ação PDCA.' USING ERRCODE = 'P0001';
    END IF;

    NEW.publicada_em = COALESCE(NEW.publicada_em, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_inspecao_publicacao ON public.inspecoes;
CREATE TRIGGER trg_validar_inspecao_publicacao
BEFORE INSERT OR UPDATE OF status, publicada_em ON public.inspecoes
FOR EACH ROW
EXECUTE FUNCTION public.validar_inspecao_publicacao();
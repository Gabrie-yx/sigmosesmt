
CREATE OR REPLACE FUNCTION public.excluir_convocacao_extra_lider(_hora_extra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec record;
  v_lider record;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_rec FROM public.hora_extra_sabado WHERE id = _hora_extra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convocação não encontrada';
  END IF;

  IF public.has_role(v_uid,'admin') OR public.has_module_access(v_uid,'administrativo') THEN
    NULL;
  ELSE
    SELECT * INTO v_lider FROM public.meu_lider_extra();
    IF v_lider.id IS NULL OR v_lider.id <> v_rec.lider_id THEN
      RAISE EXCEPTION 'Somente o líder que criou pode excluir';
    END IF;
    IF v_rec.status = 'APROVADA' THEN
      RAISE EXCEPTION 'Convocação já aprovada não pode ser excluída pelo líder — fale com o Anderson/Admin';
    END IF;
  END IF;

  UPDATE public.hora_extra_sabado_funcionarios
     SET deleted_at = now(), deleted_by = v_uid, delete_reason = 'Arquivada junto com a convocação'
   WHERE hora_extra_id = _hora_extra_id
     AND deleted_at IS NULL;

  UPDATE public.hora_extra_sabado
     SET deleted_at = now(), deleted_by = v_uid, delete_reason = 'Arquivada pelo fluxo de exclusão; histórico preservado'
   WHERE id = _hora_extra_id
     AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_desligamento_pacote(_pacote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  r public.desligamento_pacotes%ROWTYPE;
  v_hash text;
  v_antigos uuid[];
BEGIN
  IF v_user IS NULL OR NOT public.is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar pacote de rescisão';
  END IF;

  SELECT * INTO r FROM public.desligamento_pacotes WHERE id = _pacote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado'; END IF;
  IF r.status <> 'RASCUNHO' THEN RAISE EXCEPTION 'Pacote já finalizado'; END IF;
  IF r.employee_id IS NULL THEN RAISE EXCEPTION 'Pacote sem funcionário vinculado'; END IF;
  IF r.data_desligamento IS NULL OR r.data_desligamento > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de desligamento inválida';
  END IF;
  IF r.motivo IS NULL OR length(trim(r.motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo de desligamento obrigatório';
  END IF;
  IF r.aso_exam_id IS NULL AND NOT COALESCE(r.aso_dispensado, false) THEN
    RAISE EXCEPTION 'ASO demissional obrigatório (NR-07) — informe o exame ou registre a dispensa';
  END IF;
  IF COALESCE(r.aso_dispensado, false)
     AND (r.aso_dispensa_justificativa IS NULL OR length(trim(r.aso_dispensa_justificativa)) < 10) THEN
    RAISE EXCEPTION 'Dispensa do ASO exige justificativa (mín. 10 caracteres)';
  END IF;

  PERFORM public.registrar_desligamento_funcionario(
    r.employee_id, r.data_desligamento, trim(r.motivo), r.observacoes, COALESCE(r.checklist, '{}'::jsonb)
  );

  v_hash := public.sigmo_sha256(
    coalesce(r.employee_id::text,'') || '|' || coalesce(r.data_desligamento::text,'') || '|' ||
    coalesce(trim(r.motivo),'') || '|' || coalesce(r.aso_exam_id::text,'') || '|' ||
    coalesce(r.ppp_emissao_id::text,'') || '|' || coalesce(r.epis_devolvidos::text,'[]') || '|' ||
    coalesce(r.epis_pendentes::text,'[]') || '|' || coalesce(r.oss_afetadas::text,'[]') || '|' ||
    coalesce(r.checklist::text,'{}')
  );

  -- Desligamento anterior (funcionário reativado e desligado de novo): o pacote antigo
  -- vira CANCELADO (preservado) para liberar a emissão do novo.
  WITH upd AS (
    UPDATE public.desligamento_pacotes
       SET status = 'CANCELADO', updated_at = now()
     WHERE employee_id = r.employee_id AND status = 'EMITIDO' AND id <> _pacote_id
    RETURNING id
  ) SELECT array_agg(id) INTO v_antigos FROM upd;

  UPDATE public.desligamento_pacotes
     SET status = 'EMITIDO', emitido_em = now(), emitido_por = v_user,
         sha256_snapshot = v_hash, updated_at = now()
   WHERE id = _pacote_id;

  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (v_user, 'RESCISAO_PACOTE_EMITIDO', 'desligamento_pacotes', _pacote_id,
      jsonb_build_object('employee_id', r.employee_id, 'data_desligamento', r.data_desligamento,
        'sha256', v_hash, 'aso_dispensado', COALESCE(r.aso_dispensado, false),
        'ppp_emissao_id', r.ppp_emissao_id, 'regularizacao', COALESCE(r.regularizacao, false),
        'pacotes_anteriores_cancelados', to_jsonb(v_antigos)));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES (v_user, 'RESCISAO_PACOTE_EMITIDO', 'desligamento_pacotes', _pacote_id,
        jsonb_build_object('employee_id', r.employee_id, 'data_desligamento', r.data_desligamento,
          'sha256', v_hash, 'pacotes_anteriores_cancelados', to_jsonb(v_antigos)));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) TO service_role;
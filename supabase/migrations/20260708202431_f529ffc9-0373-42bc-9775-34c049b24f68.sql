-- Correção definitiva do bloco de funções de desligamento/rescisão SST.
-- Raiz do erro: pgcrypto está instalado no schema extensions; a função finalizadora chamava digest() sem qualificar o schema.

CREATE OR REPLACE FUNCTION public.sigmo_sha256(_payload text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT encode(extensions.digest(convert_to(COALESCE(_payload, ''), 'UTF8'), 'sha256'), 'hex')
$$;

REVOKE EXECUTE ON FUNCTION public.sigmo_sha256(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sigmo_sha256(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sigmo_sha256(text) TO service_role;

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
BEGIN
  IF v_user IS NULL OR NOT public.is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar pacote de rescisão';
  END IF;

  SELECT * INTO r
    FROM public.desligamento_pacotes
   WHERE id = _pacote_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pacote não encontrado';
  END IF;

  IF r.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'Pacote já finalizado';
  END IF;

  IF r.employee_id IS NULL THEN
    RAISE EXCEPTION 'Pacote sem funcionário vinculado';
  END IF;

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

  -- Aciona a rotina oficial de desligamento. Essa rotina dispara os gatilhos de cascata:
  -- OSs ativas substituídas, bloqueio global, convocação demissional, portaria e auditoria.
  PERFORM public.registrar_desligamento_funcionario(
    r.employee_id,
    r.data_desligamento,
    trim(r.motivo),
    r.observacoes,
    COALESCE(r.checklist, '{}'::jsonb)
  );

  -- Hash de integridade isolado e qualificado via extensions.digest(), sem depender do search_path.
  v_hash := public.sigmo_sha256(
    coalesce(r.employee_id::text,'') || '|' ||
    coalesce(r.data_desligamento::text,'') || '|' ||
    coalesce(trim(r.motivo),'') || '|' ||
    coalesce(r.aso_exam_id::text,'') || '|' ||
    coalesce(r.ppp_emissao_id::text,'') || '|' ||
    coalesce(r.epis_devolvidos::text,'[]') || '|' ||
    coalesce(r.epis_pendentes::text,'[]') || '|' ||
    coalesce(r.oss_afetadas::text,'[]') || '|' ||
    coalesce(r.checklist::text,'{}')
  );

  UPDATE public.desligamento_pacotes
     SET status = 'EMITIDO',
         emitido_em = now(),
         emitido_por = v_user,
         sha256_snapshot = v_hash,
         updated_at = now()
   WHERE id = _pacote_id;

  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (
      v_user,
      'RESCISAO_PACOTE_EMITIDO',
      'desligamento_pacotes',
      _pacote_id,
      jsonb_build_object(
        'employee_id', r.employee_id,
        'data_desligamento', r.data_desligamento,
        'sha256', v_hash,
        'aso_dispensado', COALESCE(r.aso_dispensado, false),
        'ppp_emissao_id', r.ppp_emissao_id,
        'regularizacao', COALESCE(r.regularizacao, false)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Alguns ambientes antigos usam audit_logs com nomes de coluna diferentes.
    -- Não bloqueia a rescisão por falha de auditoria secundária.
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES (
        v_user,
        'RESCISAO_PACOTE_EMITIDO',
        'desligamento_pacotes',
        _pacote_id,
        jsonb_build_object(
          'employee_id', r.employee_id,
          'data_desligamento', r.data_desligamento,
          'sha256', v_hash,
          'aso_dispensado', COALESCE(r.aso_dispensado, false),
          'ppp_emissao_id', r.ppp_emissao_id,
          'regularizacao', COALESCE(r.regularizacao, false)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) TO service_role;

-- Garante que a RPC direta de desligamento continua disponível apenas para usuários autenticados.
REVOKE EXECUTE ON FUNCTION public.registrar_desligamento_funcionario(uuid, date, text, text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.registrar_desligamento_funcionario(uuid, date, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_desligamento_funcionario(uuid, date, text, text, jsonb) TO service_role;
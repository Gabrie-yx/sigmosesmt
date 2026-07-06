CREATE OR REPLACE FUNCTION public.substituir_funcionarios_hora_extra(
  _hora_extra_id uuid,
  _funcionarios jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_conv record;
  v_item jsonb;
  v_employee_id uuid;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_conv
  FROM public.hora_extra_sabado
  WHERE id = _hora_extra_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_conv.id IS NULL THEN
    RAISE EXCEPTION 'Ficha de hora extra não encontrada';
  END IF;

  IF NOT (public.is_editor(v_uid) OR public.has_role(v_uid, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para editar funcionários da ficha';
  END IF;

  UPDATE public.hora_extra_sabado_funcionarios
     SET deleted_at = now(),
         deleted_by = v_uid,
         delete_reason = 'Arquivado por substituição da lista durante edição da ficha'
   WHERE hora_extra_id = _hora_extra_id
     AND deleted_at IS NULL;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(_funcionarios, '[]'::jsonb))
  LOOP
    v_employee_id := NULLIF(v_item->>'employee_id', '')::uuid;

    UPDATE public.hora_extra_sabado_funcionarios
       SET deleted_at = NULL,
           deleted_by = NULL,
           delete_reason = NULL,
           employee_id = v_employee_id,
           nome = COALESCE(v_item->>'nome', nome),
           externo = COALESCE((v_item->>'externo')::boolean, false),
           funcao = NULLIF(v_item->>'funcao', ''),
           transporte = COALESCE((v_item->>'transporte')::boolean, false),
           alimentacao = COALESCE((v_item->>'alimentacao')::boolean, false),
           presenca = NULLIF(v_item->>'presenca', ''),
           ordem = COALESCE((v_item->>'ordem')::int, 0)
     WHERE hora_extra_id = _hora_extra_id
       AND (
         (v_employee_id IS NOT NULL AND employee_id = v_employee_id)
         OR (v_employee_id IS NULL AND employee_id IS NULL AND lower(unaccent(nome)) = lower(unaccent(COALESCE(v_item->>'nome',''))))
       )
     RETURNING id INTO v_row_id;

    IF v_row_id IS NULL THEN
      INSERT INTO public.hora_extra_sabado_funcionarios (
        hora_extra_id, employee_id, nome, externo, funcao, transporte, alimentacao, presenca, ordem, created_at, marcado_em
      ) VALUES (
        _hora_extra_id,
        v_employee_id,
        COALESCE(v_item->>'nome', 'Sem nome'),
        COALESCE((v_item->>'externo')::boolean, false),
        NULLIF(v_item->>'funcao', ''),
        COALESCE((v_item->>'transporte')::boolean, false),
        COALESCE((v_item->>'alimentacao')::boolean, false),
        NULLIF(v_item->>'presenca', ''),
        COALESCE((v_item->>'ordem')::int, 0),
        now(),
        now()
      );
    END IF;

    v_row_id := NULL;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.substituir_funcionarios_hora_extra(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.substituir_funcionarios_hora_extra(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.substituir_funcionarios_hora_extra(uuid, jsonb) TO service_role;
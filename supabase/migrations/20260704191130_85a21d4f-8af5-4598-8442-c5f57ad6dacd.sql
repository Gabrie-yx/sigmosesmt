
-- 1. Sobrescreve criar_convocacao_extra_lider para aceitar lista de funcionários já marcados
CREATE OR REPLACE FUNCTION public.criar_convocacao_extra_lider(
  _tipo text,
  _data date,
  _horario_inicio text,
  _horario_fim text,
  _justificativa text,
  _employee_ids uuid[] DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lider record;
  v_id uuid;
  v_nome text;
  v_emp_id uuid;
  v_emp_nome text;
  v_convocaveis uuid[];
BEGIN
  SELECT * INTO v_lider FROM public.meu_lider_extra();
  IF v_lider.id IS NULL THEN
    RAISE EXCEPTION 'Você não está cadastrado como líder de convocação de extra';
  END IF;

  IF _tipo NOT IN ('SABADO','DIAS_UTEIS') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  IF _data IS NULL OR _horario_inicio IS NULL OR _horario_fim IS NULL THEN
    RAISE EXCEPTION 'Informe data, hora início e hora fim';
  END IF;
  IF _justificativa IS NULL OR length(btrim(_justificativa)) < 5 THEN
    RAISE EXCEPTION 'Justificativa é obrigatória (mín. 5 caracteres)';
  END IF;

  SELECT nome INTO v_nome FROM public.employees WHERE id = v_lider.employee_id;

  INSERT INTO public.hora_extra_sabado (
    data, turno, horario_inicio, horario_fim,
    lider_id, tipo_convocacao, justificativa, status,
    created_by, aberto_por, aberto_por_nome, aberto_marcadores_em,
    criado_automatico, criado_automatico_por_nome
  ) VALUES (
    _data,
    CASE WHEN _tipo='SABADO' THEN 'sabado' ELSE 'dia_util' END,
    _horario_inicio, _horario_fim,
    v_lider.id, _tipo, btrim(_justificativa), 'PENDENTE',
    auth.uid(), auth.uid(), v_nome, now(),
    false, v_nome
  ) RETURNING id INTO v_id;

  -- Insere funcionários já selecionados (validando escopo do líder)
  IF _employee_ids IS NOT NULL AND array_length(_employee_ids,1) > 0 THEN
    SELECT array_agg(x.id) INTO v_convocaveis
      FROM public.listar_convocaveis_lider(v_lider.id) x;

    FOREACH v_emp_id IN ARRAY _employee_ids LOOP
      IF v_convocaveis IS NULL OR NOT (v_emp_id = ANY(v_convocaveis)) THEN
        CONTINUE;
      END IF;
      SELECT nome INTO v_emp_nome FROM public.employees WHERE id = v_emp_id;
      INSERT INTO public.hora_extra_sabado_funcionarios (
        hora_extra_id, employee_id, nome, externo,
        marcado_por, marcado_por_nome, marcado_em
      ) VALUES (
        v_id, v_emp_id, v_emp_nome, false,
        auth.uid(), v_nome, now()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

-- 2. Excluir convocação (só o líder criador ou admin, e apenas se PENDENTE ou INDEFERIDA)
CREATE OR REPLACE FUNCTION public.excluir_convocacao_extra_lider(
  _hora_extra_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_lider record;
BEGIN
  SELECT * INTO v_rec FROM public.hora_extra_sabado WHERE id = _hora_extra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convocação não encontrada';
  END IF;

  IF public.has_role(auth.uid(),'admin') THEN
    NULL; -- admin sempre pode
  ELSE
    SELECT * INTO v_lider FROM public.meu_lider_extra();
    IF v_lider.id IS NULL OR v_lider.id <> v_rec.lider_id THEN
      RAISE EXCEPTION 'Somente o líder que criou pode excluir';
    END IF;
    IF v_rec.status = 'APROVADA' THEN
      RAISE EXCEPTION 'Convocação já aprovada não pode ser excluída pelo líder — fale com o Anderson/Admin';
    END IF;
  END IF;

  DELETE FROM public.hora_extra_sabado_funcionarios WHERE hora_extra_id = _hora_extra_id;
  DELETE FROM public.hora_extra_sabado WHERE id = _hora_extra_id;
END;
$$;

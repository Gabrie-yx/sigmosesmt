-- 1. Aceita turno explícito no RPC do líder
CREATE OR REPLACE FUNCTION public.criar_convocacao_extra_lider(
  _tipo text,
  _data date,
  _horario_inicio text,
  _horario_fim text,
  _justificativa text,
  _employee_ids uuid[] DEFAULT NULL,
  _turno text DEFAULT NULL
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
  v_turno_final text;
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
    RAISE EXCEPTION 'Motivo da extra é obrigatório (mín. 5 caracteres)';
  END IF;

  v_turno_final := COALESCE(NULLIF(btrim(_turno), ''),
                            CASE WHEN _tipo='SABADO' THEN 'sabado' ELSE 'dia_util' END);

  SELECT nome INTO v_nome FROM public.employees WHERE id = v_lider.employee_id;

  INSERT INTO public.hora_extra_sabado (
    data, turno, horario_inicio, horario_fim,
    lider_id, tipo_convocacao, justificativa, status,
    created_by, aberto_por, aberto_por_nome, aberto_marcadores_em,
    criado_automatico, criado_automatico_por_nome
  ) VALUES (
    _data, v_turno_final, _horario_inicio, _horario_fim,
    v_lider.id, _tipo, btrim(_justificativa), 'PENDENTE',
    auth.uid(), auth.uid(), v_nome, now(),
    false, v_nome
  ) RETURNING id INTO v_id;

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
      ) VALUES (v_id, v_emp_id, v_emp_nome, false, auth.uid(), v_nome, now())
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

-- 2. Registra Natanael como líder da Elétrica (user_id fica NULL até ele ter conta)
INSERT INTO public.hora_extra_lideres (employee_id, user_id, ativo, observacao)
VALUES ('69f97747-394a-4147-8837-10ec54f855d1', NULL, true,
        'Líder Elétrica — vincular user_id quando Natanael tiver acesso')
ON CONFLICT (employee_id) DO UPDATE SET ativo = true;

-- 3. Escopo: apenas ele e o Leonardo (equipe Elétrica CLT DMN)
INSERT INTO public.hora_extra_lider_escopo (lider_id, tipo, employee_ids, rotulo)
SELECT l.id, 'FUNCIONARIO_ESPECIFICO',
       ARRAY['69f97747-394a-4147-8837-10ec54f855d1'::uuid,
             'ca80c694-ce45-4488-b268-736577f7c02c'::uuid],
       'Elétrica DMN'
FROM public.hora_extra_lideres l
WHERE l.employee_id = '69f97747-394a-4147-8837-10ec54f855d1'
  AND NOT EXISTS (
    SELECT 1 FROM public.hora_extra_lider_escopo e
    WHERE e.lider_id = l.id AND e.rotulo = 'Elétrica DMN'
  );
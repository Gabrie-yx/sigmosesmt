
-- 1. Retorna a linha de líder do usuário logado
CREATE OR REPLACE FUNCTION public.meu_lider_extra()
RETURNS TABLE(
  id uuid, employee_id uuid, user_id uuid, nome text, observacao text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.employee_id, l.user_id, e.nome, l.observacao
  FROM public.hora_extra_lideres l
  JOIN public.employees e ON e.id = l.employee_id
  WHERE l.user_id = auth.uid() AND l.ativo = true
  LIMIT 1;
$$;

-- 2. Lista funcionários no escopo do líder
CREATE OR REPLACE FUNCTION public.listar_convocaveis_lider(_lider_id uuid)
RETURNS TABLE(
  id uuid, nome text, setor text, funcao text, tipo_vinculo text,
  empresa_id uuid, empresa_nome text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  esc record;
BEGIN
  -- valida permissão: só o próprio líder, admin ou supervisor_extra_geral
  IF NOT (
    EXISTS (SELECT 1 FROM public.hora_extra_lideres WHERE id = _lider_id AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor_extra_geral')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver escopo deste líder';
  END IF;

  FOR esc IN
    SELECT * FROM public.hora_extra_lider_escopo WHERE lider_id = _lider_id
  LOOP
    IF esc.tipo = 'EMPRESA' THEN
      RETURN QUERY
        SELECT e.id, e.nome, e.setor, e.funcao, e.tipo_vinculo::text,
               c.id, c.name
        FROM public.employees e
        LEFT JOIN public.companies c ON c.id = e.company_id
        WHERE e.status = 'ATIVO' AND e.company_id = esc.company_id;

    ELSIF esc.tipo = 'EMPRESA_LISTA' THEN
      RETURN QUERY
        SELECT e.id, e.nome, e.setor, e.funcao, e.tipo_vinculo::text,
               c.id, c.name
        FROM public.employees e
        LEFT JOIN public.companies c ON c.id = e.company_id
        WHERE e.status = 'ATIVO' AND e.company_id = ANY(esc.company_ids);

    ELSIF esc.tipo = 'SETOR_EMPRESA' THEN
      RETURN QUERY
        SELECT e.id, e.nome, e.setor, e.funcao, e.tipo_vinculo::text,
               c.id, c.name
        FROM public.employees e
        LEFT JOIN public.companies c ON c.id = e.company_id
        WHERE e.status = 'ATIVO'
          AND e.company_id = esc.company_id
          AND (esc.setores IS NULL OR e.setor = ANY(esc.setores));

    ELSIF esc.tipo = 'FUNCIONARIO_ESPECIFICO' THEN
      RETURN QUERY
        SELECT e.id, e.nome, e.setor, e.funcao, e.tipo_vinculo::text,
               c.id, c.name
        FROM public.employees e
        LEFT JOIN public.companies c ON c.id = e.company_id
        WHERE e.status = 'ATIVO' AND e.id = ANY(esc.employee_ids);
    END IF;
  END LOOP;
END;
$$;

-- 3. Líder cria uma convocação
CREATE OR REPLACE FUNCTION public.criar_convocacao_extra_lider(
  _tipo text,               -- 'SABADO' | 'DIAS_UTEIS'
  _data date,
  _horario_inicio text,
  _horario_fim text,
  _justificativa text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lider record;
  v_id uuid;
  v_nome text;
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

  RETURN v_id;
END;
$$;

-- 4. Anderson aprova ou indefere
CREATE OR REPLACE FUNCTION public.decidir_convocacao_extra(
  _hora_extra_id uuid,
  _aprovar boolean,
  _motivo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'supervisor_extra_geral') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas supervisor_extra_geral pode decidir convocações';
  END IF;
  IF NOT _aprovar AND (_motivo IS NULL OR length(btrim(_motivo)) < 5) THEN
    RAISE EXCEPTION 'Motivo de indeferimento é obrigatório (mín. 5 caracteres)';
  END IF;

  UPDATE public.hora_extra_sabado
     SET status = CASE WHEN _aprovar THEN 'APROVADA' ELSE 'INDEFERIDA' END,
         supervisor_id = auth.uid(),
         supervisor_decisao_em = now(),
         motivo_indeferimento = CASE WHEN _aprovar THEN NULL ELSE btrim(_motivo) END,
         updated_at = now()
   WHERE id = _hora_extra_id;
END;
$$;

-- 5. Lista convocações do líder logado
CREATE OR REPLACE FUNCTION public.listar_convocacoes_extra_lider()
RETURNS TABLE(
  id uuid, data date, tipo_convocacao text, horario_inicio text, horario_fim text,
  justificativa text, status text, motivo_indeferimento text,
  qtd_marcados bigint, criado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.data, h.tipo_convocacao, h.horario_inicio, h.horario_fim,
         h.justificativa, h.status, h.motivo_indeferimento,
         (SELECT count(*) FROM public.hora_extra_sabado_funcionarios f WHERE f.hora_extra_id = h.id),
         h.created_at
  FROM public.hora_extra_sabado h
  JOIN public.hora_extra_lideres l ON l.id = h.lider_id
  WHERE l.user_id = auth.uid()
  ORDER BY h.data DESC, h.created_at DESC;
$$;

-- 6. Fila do supervisor
CREATE OR REPLACE FUNCTION public.listar_convocacoes_pendentes_supervisor()
RETURNS TABLE(
  id uuid, data date, tipo_convocacao text, horario_inicio text, horario_fim text,
  justificativa text, status text,
  lider_nome text, qtd_marcados bigint, criado_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.data, h.tipo_convocacao, h.horario_inicio, h.horario_fim,
         h.justificativa, h.status,
         e.nome,
         (SELECT count(*) FROM public.hora_extra_sabado_funcionarios f WHERE f.hora_extra_id = h.id),
         h.created_at
  FROM public.hora_extra_sabado h
  LEFT JOIN public.hora_extra_lideres l ON l.id = h.lider_id
  LEFT JOIN public.employees e ON e.id = l.employee_id
  WHERE h.status IN ('PENDENTE','APROVADA','INDEFERIDA')
    AND h.lider_id IS NOT NULL
  ORDER BY
    CASE h.status WHEN 'PENDENTE' THEN 0 WHEN 'APROVADA' THEN 1 ELSE 2 END,
    h.data DESC, h.created_at DESC;
$$;

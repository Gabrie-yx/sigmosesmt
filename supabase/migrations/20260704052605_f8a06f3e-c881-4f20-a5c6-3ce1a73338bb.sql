
-- =========================================================================
-- EXTRA DE SÁBADO — Correções de concorrência e regras
-- =========================================================================

-- FIX #1: Anti-duplicação de marcação do mesmo funcionário na mesma convocação
CREATE UNIQUE INDEX IF NOT EXISTS uq_hora_extra_func_conv_emp
  ON public.hora_extra_sabado_funcionarios (hora_extra_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- FIX #5: pode_gerir_extra_sabado — remove moderador (só admin + tst)
CREATE OR REPLACE FUNCTION public.pode_gerir_extra_sabado(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'tst'::public.app_role);
$$;

-- =========================================================================
-- FIX #2 + #6 + REGRA NOVA:
--   - advisory lock por DATA (serializa aberturas concorrentes)
--   - se JÁ EXISTE convocação aberta e não expirada pra mesma data → bloqueia
--   - idempotente (não sobrescreve aberto_por se já aberto)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.abrir_convocacao_marcadores(
  _hora_extra_id uuid,
  _edit_ate timestamptz DEFAULT NULL,
  _expira_em timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_data date;
  v_sexta date;
  v_ja_aberto_id uuid;
  v_ja_aberto_em timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerir_extra_sabado(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para abrir convocação de sábado';
  END IF;

  SELECT data, aberto_marcadores_em INTO v_data, v_ja_aberto_em
    FROM public.hora_extra_sabado WHERE id = _hora_extra_id
    FOR UPDATE;
  IF v_data IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  -- Idempotente: já aberta e ainda ativa → apenas retorna
  IF v_ja_aberto_em IS NOT NULL THEN
    RETURN;
  END IF;

  -- Advisory lock keyed por data (serializa aberturas concorrentes p/ mesmo sábado)
  PERFORM pg_advisory_xact_lock(
    hashtext('hora_extra_sabado_abrir:' || v_data::text)
  );

  -- Trava: já existe OUTRA convocação aberta e não expirada pra esta data?
  SELECT id INTO v_ja_aberto_id
    FROM public.hora_extra_sabado
   WHERE data = v_data
     AND id <> _hora_extra_id
     AND aberto_marcadores_em IS NOT NULL
     AND (marcadores_expira_em IS NULL OR marcadores_expira_em > now())
   LIMIT 1;
  IF v_ja_aberto_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe uma convocação aberta para % (id=%). Feche/expire a atual antes de abrir outra.',
      v_data, v_ja_aberto_id;
  END IF;

  v_sexta := v_data - INTERVAL '1 day';
  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.hora_extra_sabado SET
    aberto_marcadores_em = now(),
    aberto_por = v_uid,
    aberto_por_nome = COALESCE(v_nome, 'Admin'),
    marcadores_edit_ate = COALESCE(_edit_ate,
      (v_sexta::timestamp + TIME '18:29:59') AT TIME ZONE 'America/Sao_Paulo'),
    marcadores_expira_em = COALESCE(_expira_em,
      (v_sexta::timestamp + TIME '19:00:00') AT TIME ZONE 'America/Sao_Paulo')
  WHERE id = _hora_extra_id
    AND aberto_marcadores_em IS NULL;  -- guard extra
END;
$$;

-- =========================================================================
-- FIX #1 (parte 2): marcar_funcionario com ON CONFLICT DO NOTHING
-- =========================================================================
CREATE OR REPLACE FUNCTION public.marcar_funcionario_sabado(
  _hora_extra_id uuid,
  _employee_id uuid,
  _transporte boolean DEFAULT true,
  _alimentacao boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_marcador boolean;
  v_conv record;
  v_emp_nome text;
  v_emp_setor text;
  v_marc_nome text;
  v_max_ordem int;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    INTO v_marcador;
  IF NOT (v_admin OR v_marcador) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  -- Lock na convocação p/ serializar ordem + janela
  SELECT id, aberto_marcadores_em, marcadores_edit_ate, marcadores_expira_em
    INTO v_conv FROM public.hora_extra_sabado WHERE id = _hora_extra_id FOR UPDATE;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  IF NOT v_admin THEN
    IF v_conv.aberto_marcadores_em IS NULL THEN
      RAISE EXCEPTION 'Convocação não foi aberta para marcadores';
    END IF;
    IF v_conv.marcadores_edit_ate IS NOT NULL AND now() > v_conv.marcadores_edit_ate THEN
      RAISE EXCEPTION 'Janela encerrada';
    END IF;
    IF NOT public.marcador_pode_marcar_employee(v_uid, _employee_id) THEN
      RAISE EXCEPTION 'Funcionário fora do seu escopo';
    END IF;
  END IF;

  -- Já marcado? Retorna direto (idempotente + anti-corrida)
  SELECT id INTO v_row_id
    FROM public.hora_extra_sabado_funcionarios
   WHERE hora_extra_id = _hora_extra_id AND employee_id = _employee_id;
  IF v_row_id IS NOT NULL THEN RETURN v_row_id; END IF;

  SELECT nome, setor INTO v_emp_nome, v_emp_setor
    FROM public.employees WHERE id = _employee_id;
  IF v_emp_nome IS NULL THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
    FROM public.hora_extra_sabado_funcionarios WHERE hora_extra_id = _hora_extra_id;

  SELECT full_name INTO v_marc_nome FROM public.profiles WHERE id = v_uid;
  IF v_marc_nome IS NULL THEN
    SELECT email INTO v_marc_nome FROM auth.users WHERE id = v_uid;
  END IF;

  INSERT INTO public.hora_extra_sabado_funcionarios (
    hora_extra_id, employee_id, nome, externo, funcao,
    transporte, alimentacao, ordem,
    marcado_por, marcado_por_nome, marcado_em
  ) VALUES (
    _hora_extra_id, _employee_id, v_emp_nome, false, v_emp_setor,
    COALESCE(_transporte, true), COALESCE(_alimentacao, true), v_max_ordem,
    v_uid, v_marc_nome, now()
  )
  ON CONFLICT (hora_extra_id, employee_id) DO NOTHING
  RETURNING id INTO v_row_id;

  -- Se conflitou (outra transação inseriu antes), busca o id existente
  IF v_row_id IS NULL THEN
    SELECT id INTO v_row_id
      FROM public.hora_extra_sabado_funcionarios
     WHERE hora_extra_id = _hora_extra_id AND employee_id = _employee_id;
  END IF;

  RETURN v_row_id;
END;
$$;

-- =========================================================================
-- FIX #2 + #3: get_or_create com advisory lock + "próximo sábado" correto
-- (se hoje é sábado e já passou 19h São Paulo, pula p/ próximo)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_convocacao_sabado_atual()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_marcador boolean;
  v_now_sp timestamptz := now();
  v_hoje date := (v_now_sp AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow int;
  v_sabado date;
  v_id uuid;
  v_nome text;
  v_ja_aberto_em timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    INTO v_marcador;
  IF NOT (v_admin OR v_marcador) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  v_dow := EXTRACT(DOW FROM v_hoje);   -- 0=dom, 6=sáb
  v_sabado := v_hoje + ((6 - v_dow + 7) % 7);
  -- Se hoje é sábado e já passou das 19h SP → pula p/ próximo sábado
  IF v_dow = 6 AND v_now_sp >= ((v_hoje::timestamp + TIME '19:00') AT TIME ZONE 'America/Sao_Paulo') THEN
    v_sabado := v_hoje + 7;
  END IF;

  -- Advisory lock por data — serializa criações concorrentes p/ mesmo sábado
  PERFORM pg_advisory_xact_lock(
    hashtext('hora_extra_sabado_getorcreate:' || v_sabado::text)
  );

  -- Convocação já aberta pros marcadores nesse sábado?
  SELECT id INTO v_id FROM public.hora_extra_sabado
   WHERE data = v_sabado
     AND aberto_marcadores_em IS NOT NULL
     AND (marcadores_expira_em IS NULL OR marcadores_expira_em > now())
   ORDER BY aberto_marcadores_em DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Qualquer convocação existente pro sábado (ainda não aberta)?
  SELECT id, aberto_marcadores_em INTO v_id, v_ja_aberto_em FROM public.hora_extra_sabado
   WHERE data = v_sabado ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    -- Cria em branco
    SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;
    INSERT INTO public.hora_extra_sabado (
      data, tipo_efetivo, created_by, criado_automatico, criado_automatico_por_nome
    ) VALUES (
      v_sabado, 'DMN', v_uid, NOT v_admin, CASE WHEN v_admin THEN NULL ELSE COALESCE(v_nome, 'Marcador') END
    ) RETURNING id INTO v_id;
  END IF;

  -- Abre pros marcadores (só se ainda não aberta)
  IF v_ja_aberto_em IS NULL THEN
    PERFORM public.abrir_convocacao_marcadores(v_id, NULL, NULL);
  END IF;

  RETURN v_id;
END;
$$;

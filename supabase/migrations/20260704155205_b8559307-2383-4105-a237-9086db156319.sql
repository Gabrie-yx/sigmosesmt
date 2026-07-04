-- Corrige Paulo Sérgio como marcador de Extra de Sábado
INSERT INTO public.user_roles (user_id, role)
VALUES ('c5bd8316-c958-4b69-982c-41dd692a15b6'::uuid, 'extra_sabado_marcador'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.hora_extra_marcadores (
  user_id,
  nome,
  ativo,
  escopo,
  self_employee_id,
  criado_por
)
VALUES (
  'c5bd8316-c958-4b69-982c-41dd692a15b6'::uuid,
  'Paulo Sérgio',
  true,
  '{"tipo":"SETOR","valores":["PRODUCAO"]}'::jsonb,
  '166db4c6-02ca-4792-ac59-67c89821b775'::uuid,
  NULL
)
ON CONFLICT (user_id) DO UPDATE SET
  nome = EXCLUDED.nome,
  ativo = true,
  escopo = EXCLUDED.escopo,
  self_employee_id = EXCLUDED.self_employee_id,
  updated_at = now();

-- Corrige criação/abertura automática para marcadores sem chamar a rotina admin-only
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
  v_sexta date;
  v_id uuid;
  v_nome text;
  v_ja_aberto_em timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    INTO v_marcador;
  IF NOT (v_admin OR v_marcador) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  v_dow := EXTRACT(DOW FROM v_hoje); -- 0=dom, 6=sáb
  v_sabado := v_hoje + ((6 - v_dow + 7) % 7);
  v_sexta := v_sabado - INTERVAL '1 day';

  -- Se a janela de marcação do sábado calculado já fechou (sexta 19h SP), pula para o próximo sábado.
  IF v_now_sp >= ((v_sexta::timestamp + TIME '19:00') AT TIME ZONE 'America/Sao_Paulo') THEN
    v_sabado := v_sabado + 7;
    v_sexta := v_sabado - INTERVAL '1 day';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('hora_extra_sabado_getorcreate:' || v_sabado::text));

  -- Convocação já aberta e ativa para a janela atual
  SELECT id INTO v_id FROM public.hora_extra_sabado
   WHERE data = v_sabado
     AND aberto_marcadores_em IS NOT NULL
     AND (marcadores_expira_em IS NULL OR marcadores_expira_em > now())
   ORDER BY aberto_marcadores_em DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Convocação existente para o sábado escolhido
  SELECT id, aberto_marcadores_em INTO v_id, v_ja_aberto_em FROM public.hora_extra_sabado
   WHERE data = v_sabado ORDER BY created_at DESC LIMIT 1;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  IF v_id IS NULL THEN
    INSERT INTO public.hora_extra_sabado (
      data, tipo_efetivo, created_by, criado_automatico, criado_automatico_por_nome
    ) VALUES (
      v_sabado, 'DMN', v_uid, NOT v_admin, CASE WHEN v_admin THEN NULL ELSE COALESCE(v_nome, 'Marcador') END
    ) RETURNING id INTO v_id;
    v_ja_aberto_em := NULL;
  END IF;

  -- Abertura automática: permitida aqui porque a função já validou admin ou marcador ativo.
  IF v_ja_aberto_em IS NULL THEN
    UPDATE public.hora_extra_sabado SET
      aberto_marcadores_em = now(),
      aberto_por = v_uid,
      aberto_por_nome = COALESCE(v_nome, CASE WHEN v_admin THEN 'Admin' ELSE 'Marcador' END),
      marcadores_edit_ate = (v_sexta::timestamp + TIME '18:29:59') AT TIME ZONE 'America/Sao_Paulo',
      marcadores_expira_em = (v_sexta::timestamp + TIME '19:00:00') AT TIME ZONE 'America/Sao_Paulo'
    WHERE id = v_id
      AND aberto_marcadores_em IS NULL;
  END IF;

  RETURN v_id;
END;
$$;
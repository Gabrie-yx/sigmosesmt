
-- marcar_funcionario_sabado — aceita líder OU marcador legado
CREATE OR REPLACE FUNCTION public.marcar_funcionario_sabado(
  _hora_extra_id uuid, _employee_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_permitido boolean;
  v_conv record;
  v_marc_nome text;
  v_max_ordem int;
  v_row_id uuid;
  v_emp record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT (
    EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    OR EXISTS(SELECT 1 FROM public.hora_extra_lideres WHERE user_id = v_uid AND ativo = true)
  ) INTO v_permitido;
  IF NOT (v_admin OR v_permitido) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO v_conv FROM public.hora_extra_sabado WHERE id = _hora_extra_id FOR UPDATE;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  IF v_conv.status = 'INDEFERIDA' THEN
    RAISE EXCEPTION 'Convocação indeferida — não é possível marcar';
  END IF;

  SELECT id, nome, funcao INTO v_emp FROM public.employees WHERE id = _employee_id;
  IF v_emp.id IS NULL THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;

  -- Evita duplicata
  IF EXISTS(SELECT 1 FROM public.hora_extra_sabado_funcionarios
            WHERE hora_extra_id = _hora_extra_id AND employee_id = _employee_id) THEN
    RAISE EXCEPTION 'Funcionário já marcado nesta convocação';
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
    FROM public.hora_extra_sabado_funcionarios WHERE hora_extra_id = _hora_extra_id;
  SELECT full_name INTO v_marc_nome FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.hora_extra_sabado_funcionarios (
    hora_extra_id, employee_id, nome, externo, funcao,
    transporte, alimentacao, ordem, marcado_por, marcado_por_nome, marcado_em
  ) VALUES (
    _hora_extra_id, _employee_id, v_emp.nome, false, v_emp.funcao,
    true, true, v_max_ordem, v_uid, v_marc_nome, now()
  ) RETURNING id INTO v_row_id;
  RETURN v_row_id;
END;
$function$;

-- desmarcar — aceita líder
CREATE OR REPLACE FUNCTION public.desmarcar_funcionario_sabado(_row_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_row record;
  v_permitido boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT * INTO v_row FROM public.hora_extra_sabado_funcionarios WHERE id = _row_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;

  IF NOT v_admin THEN
    SELECT (
      EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
      OR EXISTS(SELECT 1 FROM public.hora_extra_lideres WHERE user_id = v_uid AND ativo = true)
    ) INTO v_permitido;
    IF NOT v_permitido THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF v_row.marcado_por IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Só quem marcou pode desmarcar';
    END IF;
  END IF;

  DELETE FROM public.hora_extra_sabado_funcionarios WHERE id = _row_id;
END;
$function$;

-- adicionar_externo — aceita líder
CREATE OR REPLACE FUNCTION public.adicionar_externo_sabado(
  _hora_extra_id uuid, _nome text, _empresa text,
  _funcao text DEFAULT NULL, _transporte boolean DEFAULT true, _alimentacao boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_permitido boolean;
  v_conv record;
  v_marc_nome text;
  v_max_ordem int;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _nome IS NULL OR length(btrim(_nome)) < 3 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF _empresa IS NULL OR length(btrim(_empresa)) < 2 THEN RAISE EXCEPTION 'Informe a empresa do externo'; END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT (
    EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    OR EXISTS(SELECT 1 FROM public.hora_extra_lideres WHERE user_id = v_uid AND ativo = true)
  ) INTO v_permitido;
  IF NOT (v_admin OR v_permitido) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO v_conv FROM public.hora_extra_sabado WHERE id = _hora_extra_id FOR UPDATE;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;
  IF v_conv.status = 'INDEFERIDA' THEN RAISE EXCEPTION 'Convocação indeferida'; END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
    FROM public.hora_extra_sabado_funcionarios WHERE hora_extra_id = _hora_extra_id;
  SELECT full_name INTO v_marc_nome FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.hora_extra_sabado_funcionarios (
    hora_extra_id, employee_id, nome, externo, funcao, externo_empresa,
    transporte, alimentacao, ordem, marcado_por, marcado_por_nome, marcado_em
  ) VALUES (
    _hora_extra_id, NULL, btrim(_nome), true, NULLIF(btrim(COALESCE(_funcao,'')),''), btrim(_empresa),
    COALESCE(_transporte, true), COALESCE(_alimentacao, true), v_max_ordem,
    v_uid, v_marc_nome, now()
  ) RETURNING id INTO v_row_id;
  RETURN v_row_id;
END;
$function$;

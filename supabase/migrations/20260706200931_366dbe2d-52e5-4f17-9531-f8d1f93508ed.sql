-- Corrige/fortalece as RPCs de escopo automático para hora extra
CREATE OR REPLACE FUNCTION public.get_hora_extra_allowed_employee_ids(_uid uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _escopo jsonb;
  _tipo text;
  _ids uuid[];
  _exclude_emp uuid[];
  _exclude_comp uuid[];
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(_uid, 'admin'::app_role) THEN RETURN NULL; END IF;

  SELECT escopo INTO _escopo
  FROM public.hora_extra_marcadores
  WHERE user_id = _uid AND ativo = true
  LIMIT 1;

  IF _escopo IS NULL THEN RETURN NULL; END IF;
  _tipo := _escopo->>'tipo';

  IF _escopo ? 'exclude_employee_ids' THEN
    SELECT array_agg(x::uuid) INTO _exclude_emp
    FROM jsonb_array_elements_text(_escopo->'exclude_employee_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';
  END IF;

  IF _escopo ? 'exclude_company_ids' THEN
    SELECT array_agg(x::uuid) INTO _exclude_comp
    FROM jsonb_array_elements_text(_escopo->'exclude_company_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';
  END IF;

  IF _tipo = 'TERCEIRIZADAS_AUTO' THEN
    SELECT array_agg(e.id ORDER BY c.name, e.nome) INTO _ids
    FROM public.employees e
    JOIN public.companies c ON c.id = e.company_id
    WHERE COALESCE(e.status,'ATIVO') = 'ATIVO'
      AND upper(coalesce(c.type,'')) = 'TERCEIRIZADO'
      AND (_exclude_comp IS NULL OR c.id <> ALL(_exclude_comp));

  ELSIF _tipo = 'EMPLOYEES' THEN
    SELECT array_agg(x::uuid) INTO _ids
    FROM jsonb_array_elements_text(_escopo->'employee_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';

  ELSIF _tipo = 'EMPRESAS_MEIS' THEN
    SELECT array_agg(e.id ORDER BY e.nome) INTO _ids
    FROM public.employees e
    WHERE COALESCE(e.status,'ATIVO') = 'ATIVO'
      AND (
        e.company_id::text IN (SELECT jsonb_array_elements_text(_escopo->'company_ids'))
        OR upper(coalesce(e.tipo_vinculo,'')) = 'MEI'
      );

  ELSIF _tipo = 'SELF' THEN
    SELECT ARRAY[self_employee_id] INTO _ids
    FROM public.hora_extra_marcadores
    WHERE user_id = _uid AND self_employee_id IS NOT NULL;

  ELSE
    RETURN NULL;
  END IF;

  _ids := COALESCE(_ids, ARRAY[]::uuid[]);

  IF _exclude_emp IS NOT NULL AND array_length(_exclude_emp,1) > 0 THEN
    SELECT array_agg(x) INTO _ids
    FROM unnest(_ids) x
    WHERE x <> ALL(_exclude_emp);
    _ids := COALESCE(_ids, ARRAY[]::uuid[]);
  END IF;

  RETURN _ids;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_hora_extra_allowed_company_ids(_uid uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _escopo jsonb;
  _tipo text;
  _ids uuid[];
  _exclude_comp uuid[];
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(_uid, 'admin'::app_role) THEN RETURN NULL; END IF;

  SELECT escopo INTO _escopo
  FROM public.hora_extra_marcadores
  WHERE user_id = _uid AND ativo = true
  LIMIT 1;

  IF _escopo IS NULL THEN RETURN NULL; END IF;
  _tipo := _escopo->>'tipo';

  IF _escopo ? 'exclude_company_ids' THEN
    SELECT array_agg(x::uuid) INTO _exclude_comp
    FROM jsonb_array_elements_text(_escopo->'exclude_company_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';
  END IF;

  IF _tipo = 'TERCEIRIZADAS_AUTO' THEN
    SELECT array_agg(c.id ORDER BY c.name) INTO _ids
    FROM public.companies c
    WHERE upper(coalesce(c.type,'')) = 'TERCEIRIZADO'
      AND (_exclude_comp IS NULL OR c.id <> ALL(_exclude_comp));

  ELSIF _tipo = 'EMPRESAS_MEIS' THEN
    SELECT array_agg(x::uuid) INTO _ids
    FROM jsonb_array_elements_text(_escopo->'company_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';

  ELSE
    RETURN NULL;
  END IF;

  RETURN COALESCE(_ids, ARRAY[]::uuid[]);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_hora_extra_allowed_employee_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hora_extra_allowed_company_ids(uuid) TO authenticated;

-- A função usada pelo botão de marcar agora reconhece o escopo TERCEIRIZADAS_AUTO.
CREATE OR REPLACE FUNCTION public.marcador_pode_marcar_employee(_marcador_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escopo jsonb;
  v_tipo text;
  v_self uuid;
  v_emp record;
  v_allowed uuid[];
BEGIN
  IF _marcador_user_id IS NULL OR _employee_id IS NULL THEN RETURN false; END IF;

  SELECT escopo, self_employee_id INTO v_escopo, v_self
    FROM public.hora_extra_marcadores
   WHERE user_id = _marcador_user_id AND ativo = true
   LIMIT 1;

  IF v_escopo IS NULL THEN RETURN false; END IF;
  v_tipo := v_escopo->>'tipo';

  -- Escopos novos/automáticos usam a RPC central para manter uma regra única.
  IF v_tipo IN ('TERCEIRIZADAS_AUTO', 'EMPLOYEES', 'EMPRESAS_MEIS', 'SELF') THEN
    v_allowed := public.get_hora_extra_allowed_employee_ids(_marcador_user_id);
    RETURN v_allowed IS NOT NULL AND _employee_id = ANY(v_allowed);
  END IF;

  SELECT id, setor, tipo_vinculo, empresa_terceira_id, company_id
    INTO v_emp
    FROM public.employees
   WHERE id = _employee_id;

  IF v_emp.id IS NULL THEN RETURN false; END IF;

  IF v_tipo = 'TUDO' THEN
    RETURN true;

  ELSIF v_tipo = 'SETOR' THEN
    RETURN v_emp.setor = ANY(
      SELECT jsonb_array_elements_text(v_escopo->'valores')
    );

  ELSIF v_tipo = 'EMPRESA_TERCEIRA' THEN
    RETURN (
      v_emp.empresa_terceira_id::text = ANY(SELECT jsonb_array_elements_text(v_escopo->'ids'))
      OR v_emp.company_id::text = ANY(SELECT jsonb_array_elements_text(v_escopo->'ids'))
    );

  ELSIF v_tipo = 'DMN_APOIO' THEN
    RETURN v_emp.tipo_vinculo IN ('CLT','MEI')
       AND v_emp.empresa_terceira_id IS NULL
       AND v_emp.setor = ANY(
         SELECT jsonb_array_elements_text(v_escopo->'setores')
       );
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.marcador_pode_marcar_employee(uuid, uuid) TO authenticated;

-- Garante o escopo correto do Manoel: terceirizadas automáticas, PORTARIA fora e Ana Silvia fora por exceção individual.
UPDATE public.hora_extra_marcadores
SET ativo = true,
    escopo = jsonb_build_object(
      'tipo', 'TERCEIRIZADAS_AUTO',
      'exclude_company_ids', jsonb_build_array('504701b6-9bd7-40df-a164-a3173a825b62'),
      'exclude_employee_ids', jsonb_build_array('4fcf9e7a-3210-45ca-97cd-dd4ffac92633')
    ),
    updated_at = now()
WHERE user_id = '273af031-4cd7-4b79-82dd-1374607426b8';

-- Garante o menu/atalho correto para o painel de terceirizadas do Manoel.
INSERT INTO public.user_module_access (user_id, module, enabled)
VALUES ('273af031-4cd7-4b79-82dd-1374607426b8', 'producao', true)
ON CONFLICT (user_id, module) DO UPDATE
SET enabled = true, updated_at = now();

INSERT INTO public.user_menu_access (user_id, menu_key, enabled)
VALUES ('273af031-4cd7-4b79-82dd-1374607426b8', '/app/modulo/terceirizadas/hora-extra', true)
ON CONFLICT (user_id, menu_key) DO UPDATE
SET enabled = true, updated_at = now();

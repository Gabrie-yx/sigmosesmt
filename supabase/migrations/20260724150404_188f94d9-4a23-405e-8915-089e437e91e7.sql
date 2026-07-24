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
  _include_comp uuid[];
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

  IF _escopo ? 'include_company_ids' THEN
    SELECT array_agg(x::uuid) INTO _include_comp
    FROM jsonb_array_elements_text(_escopo->'include_company_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';
  END IF;

  IF _tipo = 'TERCEIRIZADAS_AUTO' THEN
    SELECT array_agg(e.id ORDER BY c.name, e.nome) INTO _ids
    FROM public.employees e
    JOIN public.companies c ON c.id = e.company_id
    WHERE COALESCE(e.status,'ATIVO') = 'ATIVO'
      AND (
        upper(coalesce(c.type,'')) = 'TERCEIRIZADO'
        OR (_include_comp IS NOT NULL AND c.id = ANY(_include_comp))
      )
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
  _include_comp uuid[];
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

  IF _escopo ? 'include_company_ids' THEN
    SELECT array_agg(x::uuid) INTO _include_comp
    FROM jsonb_array_elements_text(_escopo->'include_company_ids') x
    WHERE x ~* '^[0-9a-f-]{36}$';
  END IF;

  IF _tipo = 'TERCEIRIZADAS_AUTO' THEN
    SELECT array_agg(c.id ORDER BY c.name) INTO _ids
    FROM public.companies c
    WHERE (
        upper(coalesce(c.type,'')) = 'TERCEIRIZADO'
        OR (_include_comp IS NOT NULL AND c.id = ANY(_include_comp))
      )
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

-- Adiciona DMN ao escopo do Manoel (mantém exclusões atuais).
UPDATE public.hora_extra_marcadores
SET escopo = COALESCE(escopo, '{}'::jsonb) || jsonb_build_object(
      'include_company_ids', jsonb_build_array('09795138-3af8-48ea-a558-7d90a2a89100')
    ),
    updated_at = now()
WHERE user_id = '273af031-4cd7-4b79-82dd-1374607426b8';
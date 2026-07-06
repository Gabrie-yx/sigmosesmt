
-- 1) Corrige type das empresas: só DMN é CLT; demais são TERCEIRIZADO.
UPDATE public.companies
SET type = 'TERCEIRIZADO'
WHERE name IN ('JC GALVÃO CONSTRUÇÃO E REPARO NAVAL', 'LF SERVIÇOS DE  MANUTENÇÃO LTDA')
  AND type = 'CLT';

-- 2) Nova RPC: suporta tipo 'TERCEIRIZADAS_AUTO' que puxa todas as companies
--    com type='TERCEIRIZADO' automaticamente, respeitando exclude_company_ids
--    e exclude_employee_ids do escopo do marcador. Empresas novas entram sozinhas.
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
    FROM jsonb_array_elements_text(_escopo->'exclude_employee_ids') x;
  END IF;
  IF _escopo ? 'exclude_company_ids' THEN
    SELECT array_agg(x::uuid) INTO _exclude_comp
    FROM jsonb_array_elements_text(_escopo->'exclude_company_ids') x;
  END IF;

  IF _tipo = 'TERCEIRIZADAS_AUTO' THEN
    SELECT array_agg(e.id) INTO _ids
    FROM public.employees e
    JOIN public.companies c ON c.id = e.company_id
    WHERE COALESCE(e.status,'ATIVO') = 'ATIVO'
      AND c.type = 'TERCEIRIZADO'
      AND (_exclude_comp IS NULL OR c.id <> ALL(_exclude_comp));
  ELSIF _tipo = 'EMPLOYEES' THEN
    SELECT array_agg(x::uuid) INTO _ids
    FROM jsonb_array_elements_text(_escopo->'employee_ids') x;
  ELSIF _tipo = 'EMPRESAS_MEIS' THEN
    SELECT array_agg(e.id) INTO _ids
    FROM public.employees e
    WHERE COALESCE(e.status,'ATIVO') = 'ATIVO' AND (
      e.company_id::text IN (SELECT jsonb_array_elements_text(_escopo->'company_ids'))
      OR e.tipo_vinculo = 'MEI'
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

-- 3) Nova RPC: devolve os company_ids que o marcador enxerga (pra popular o
--    dropdown "Empresa" do dialog dinamicamente, sem lista hardcoded).
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
    FROM jsonb_array_elements_text(_escopo->'exclude_company_ids') x;
  END IF;

  IF _tipo = 'TERCEIRIZADAS_AUTO' THEN
    SELECT array_agg(c.id) INTO _ids
    FROM public.companies c
    WHERE c.type = 'TERCEIRIZADO'
      AND (_exclude_comp IS NULL OR c.id <> ALL(_exclude_comp));
  ELSIF _tipo = 'EMPRESAS_MEIS' THEN
    SELECT array_agg(x::uuid) INTO _ids
    FROM jsonb_array_elements_text(_escopo->'company_ids') x;
  ELSE
    RETURN NULL;
  END IF;

  RETURN COALESCE(_ids, ARRAY[]::uuid[]);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_hora_extra_allowed_company_ids(uuid) TO authenticated;

-- 4) Atualiza o escopo do Manoel pra regra automática: todas TERCEIRIZADO,
--    exceto PORTARIA (empresa) e Ana Silvia (pessoa).
UPDATE public.hora_extra_marcadores
SET escopo = jsonb_build_object(
  'tipo', 'TERCEIRIZADAS_AUTO',
  'exclude_company_ids', jsonb_build_array(
    '504701b6-9bd7-40df-a164-a3173a825b62'  -- PORTARIA (Manoel é produção, não vê portaria)
  ),
  'exclude_employee_ids', jsonb_build_array(
    '4fcf9e7a-3210-45ca-97cd-dd4ffac92633'  -- Ana Silvia (fica com o Israel/Almox)
  )
)
WHERE user_id = '273af031-4cd7-4b79-82dd-1374607426b8';

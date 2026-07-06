
-- 1) Atualiza RPC para suportar exclude_employee_ids no escopo do marcador.
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
  _exclude uuid[];
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
    SELECT array_agg(x::uuid) INTO _exclude
    FROM jsonb_array_elements_text(_escopo->'exclude_employee_ids') x;
  END IF;

  IF _tipo = 'EMPLOYEES' THEN
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

  IF _exclude IS NOT NULL AND array_length(_exclude,1) > 0 THEN
    SELECT array_agg(x) INTO _ids
    FROM unnest(_ids) x
    WHERE x <> ALL(_exclude);
    _ids := COALESCE(_ids, ARRAY[]::uuid[]);
  END IF;

  RETURN _ids;
END;
$function$;

-- 2) Marcador do Manoel: 6 empresas terceirizadas + MEI, excluindo Ana Silvia (do Israel).
INSERT INTO public.hora_extra_marcadores (user_id, nome, ativo, escopo)
VALUES (
  '273af031-4cd7-4b79-82dd-1374607426b8',
  'Manoel da Silva — Terceirizadas + MEI',
  true,
  jsonb_build_object(
    'tipo', 'EMPRESAS_MEIS',
    'company_ids', jsonb_build_array(
      'f5c94c27-d330-42a8-91c0-2299dc9a9a00', -- ED
      '37414ab9-e40f-47c9-b296-f654989f046a', -- JC Galvão
      '25735379-4bbe-4016-8121-82fbe7b171f4', -- M2
      '800de09b-dc70-4b33-b93b-8e805367737c', -- NB
      'eb6ce0c5-46bd-4777-8bad-2018c5981d5d', -- EZ
      '713d9c50-d96a-4ffe-a3e5-a1401b381624'  -- MEI
    ),
    'exclude_employee_ids', jsonb_build_array(
      '4fcf9e7a-3210-45ca-97cd-dd4ffac92633'  -- Ana Silvia (já no escopo do Israel)
    )
  )
)
ON CONFLICT DO NOTHING;

-- 3) Papel de marcador pro Manoel (usado pra liberar o card na sidebar).
INSERT INTO public.user_roles (user_id, role)
VALUES ('273af031-4cd7-4b79-82dd-1374607426b8', 'extra_sabado_marcador'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

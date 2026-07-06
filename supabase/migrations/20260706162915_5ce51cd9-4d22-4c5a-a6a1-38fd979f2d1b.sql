
-- 1) Nova role para marcadores de hora extra do dia-a-dia
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hora_extra_marcador';

-- 2) Função que resolve os employee_ids visíveis para o usuário logado.
--    Retorna NULL = "vê tudo" (admin ou sem escopo cadastrado).
CREATE OR REPLACE FUNCTION public.get_hora_extra_allowed_employee_ids(_uid uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _escopo jsonb;
  _tipo text;
  _ids uuid[];
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(_uid, 'admin'::app_role) THEN RETURN NULL; END IF;

  SELECT escopo INTO _escopo
  FROM public.hora_extra_marcadores
  WHERE user_id = _uid AND ativo = true
  LIMIT 1;

  IF _escopo IS NULL THEN RETURN NULL; END IF;

  _tipo := _escopo->>'tipo';

  IF _tipo = 'EMPLOYEES' THEN
    SELECT array_agg(x::uuid) INTO _ids
    FROM jsonb_array_elements_text(_escopo->'employee_ids') x;
    RETURN COALESCE(_ids, ARRAY[]::uuid[]);
  ELSIF _tipo = 'EMPRESAS_MEIS' THEN
    SELECT array_agg(e.id) INTO _ids
    FROM public.employees e
    WHERE COALESCE(e.status,'ATIVO') = 'ATIVO' AND (
      e.company_id::text IN (SELECT jsonb_array_elements_text(_escopo->'company_ids'))
      OR e.tipo_vinculo = 'MEI'
    );
    RETURN COALESCE(_ids, ARRAY[]::uuid[]);
  ELSIF _tipo = 'SELF' THEN
    SELECT ARRAY[self_employee_id] INTO _ids
    FROM public.hora_extra_marcadores
    WHERE user_id = _uid AND self_employee_id IS NOT NULL;
    RETURN COALESCE(_ids, ARRAY[]::uuid[]);
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hora_extra_allowed_employee_ids(uuid) TO authenticated;

-- 3) Cadastro do Israel Uchoa como marcador (escopo: Daniel Oliveira + Ana Silvia)
INSERT INTO public.hora_extra_marcadores (user_id, nome, ativo, escopo)
SELECT u.id,
       'Israel Uchoa — Almoxarifado',
       true,
       jsonb_build_object(
         'tipo','EMPLOYEES',
         'employee_ids', jsonb_build_array(
           '324159ca-f303-4e2f-9b05-b06b2aeeea88',  -- Daniel Oliveira de Abreu
           '4fcf9e7a-3210-45ca-97cd-dd4ffac92633'   -- Ana Silvia Barroso dos Santos
         )
       )
FROM auth.users u
WHERE u.email = 'uchoaisrael23@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET escopo = EXCLUDED.escopo,
      nome = EXCLUDED.nome,
      ativo = true,
      updated_at = now();

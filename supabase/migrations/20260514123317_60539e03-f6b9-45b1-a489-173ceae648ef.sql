
-- 1) Expandir requires_mfa para todos os papéis que tocam PII
CREATE OR REPLACE FUNCTION public.requires_mfa(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'admin'::public.app_role,
        'moderador'::public.app_role,
        'editor'::public.app_role,
        'tst'::public.app_role
      )
  );
$function$;

-- 2) Revogar EXECUTE público das funções SECURITY DEFINER e conceder apenas a authenticated
DO $$
DECLARE
  fn_signature text;
  fns text[] := ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.has_module_access(uuid, public.app_module)',
    'public.is_editor(uuid)',
    'public.is_moderator(uuid)',
    'public.is_viewer_or_above(uuid)',
    'public.requires_mfa(uuid)',
    'public.mfa_ok()',
    'public.current_aal()',
    'public.peek_proximo_numero_apr()',
    'public.gerar_numero_apr()',
    'public.gerar_numero_ordem_producao()'
  ];
BEGIN
  FOREACH fn_signature IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_signature);
  END LOOP;
END $$;

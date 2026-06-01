
-- 1. Storage policies: checklists-equipamentos - require editor for INSERT/UPDATE
DROP POLICY IF EXISTS checklists_equip_insert ON storage.objects;
DROP POLICY IF EXISTS checklists_equip_update ON storage.objects;

CREATE POLICY checklists_equip_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklists-equipamentos' AND public.is_editor(auth.uid()));

CREATE POLICY checklists_equip_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'checklists-equipamentos' AND public.is_editor(auth.uid()))
  WITH CHECK (bucket_id = 'checklists-equipamentos' AND public.is_editor(auth.uid()));

-- 2. Remove bootstrap-admin policy (privilege escalation risk if all admins removed).
-- Bootstrap should be done via service_role / migration instead.
DROP POLICY IF EXISTS user_roles_bootstrap_first_admin ON public.user_roles;

-- 3. Drop SELECT/list policies on public buckets to prevent enumeration via API.
-- Public buckets continue serving files via direct URL through the CDN.
DROP POLICY IF EXISTS avatars_authenticated_list ON storage.objects;
DROP POLICY IF EXISTS org_logos_authenticated_list ON storage.objects;
DROP POLICY IF EXISTS epis_fotos_authenticated_list ON storage.objects;

-- 4. Set fixed search_path on pt_title_case
ALTER FUNCTION public.pt_title_case(text) SET search_path = public, pg_temp;

-- 5. Revoke EXECUTE on trigger functions from anon/authenticated.
-- Trigger functions are invoked by the engine, never directly by clients.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', fn.proname);
  END LOOP;
END $$;

-- 6. Revoke EXECUTE from anon on remaining SECURITY DEFINER helpers that don't need anonymous access.
REVOKE EXECUTE ON FUNCTION public.validar_eficacia_acao(uuid, boolean, text) FROM anon, PUBLIC;

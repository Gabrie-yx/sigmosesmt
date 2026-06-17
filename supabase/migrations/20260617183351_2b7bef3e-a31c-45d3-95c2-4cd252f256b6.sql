
-- 1) Restringir INSERT no bucket incident-photos a editores
DROP POLICY IF EXISTS "incident-photos: authenticated insert" ON storage.objects;
CREATE POLICY "incident-photos: editor insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'incident-photos'
    AND public.is_editor(auth.uid())
  );

-- 2) Revogar EXECUTE público/anônimo em TODAS as funções SECURITY DEFINER do schema public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon',   r.sig);
  END LOOP;
END $$;

-- 3) Reconceder EXECUTE para authenticated apenas nas funções chamadas via RPC pelo app
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'has_role(uuid, app_role)',
    'has_module_access(uuid, text)',
    'is_editor(uuid)',
    'is_moderator(uuid)',
    'is_viewer_or_above(uuid)',
    'current_aal()',
    'mfa_ok()',
    'requires_mfa()',
    'apply_pending_invite()',
    'reativar_funcionario(uuid)',
    'registrar_desligamento_funcionario(uuid, date, text, text)',
    'registrar_entrega_epi(uuid, uuid, integer, text, text, date)',
    'registrar_movimentacao_epi(uuid, text, integer, text, text)',
    'ajustar_saldo_epi(uuid, integer, text)',
    'atestado_sync_override(uuid)',
    'peek_proximo_numero_apr(uuid)',
    'admin_count_user_sessions(uuid)',
    'admin_force_signout_user(uuid)',
    'fn_dias_sem_acidente(uuid)',
    'atualizar_recorde_dias_sem_acidente(uuid)',
    'log_audit_event(text, text, uuid, jsonb)',
    'snapshot_estoque_epi_monthly()',
    'oss_marcar_vencidas()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    EXCEPTION WHEN undefined_function THEN
      -- assinatura diferente da listada: ignora silenciosamente
      NULL;
    END;
  END LOOP;
END $$;

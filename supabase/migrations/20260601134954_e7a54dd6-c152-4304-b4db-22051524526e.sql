
-- Tabela de acesso granular por menu (sub-páginas)
CREATE TABLE IF NOT EXISTS public.user_menu_access (
  user_id UUID NOT NULL,
  menu_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, menu_key)
);

GRANT SELECT ON public.user_menu_access TO authenticated;
GRANT ALL ON public.user_menu_access TO service_role;

ALTER TABLE public.user_menu_access ENABLE ROW LEVEL SECURITY;

-- Usuário lê só os próprios menus; admin lê tudo
CREATE POLICY "user_menu_access_self_select" ON public.user_menu_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins gerenciam (via service_role nas server fns; políticas só p/ casos diretos)
CREATE POLICY "user_menu_access_admin_all" ON public.user_menu_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_user_menu_access_user ON public.user_menu_access(user_id);

-- Trigger de updated_at
CREATE TRIGGER trg_user_menu_access_updated
  BEFORE UPDATE ON public.user_menu_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auditoria automática
CREATE TRIGGER trg_user_menu_access_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.user_menu_access
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Garantir auditoria em user_roles e user_module_access (idempotente)
DROP TRIGGER IF EXISTS trg_user_roles_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_user_module_access_audit ON public.user_module_access;
CREATE TRIGGER trg_user_module_access_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.user_module_access
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

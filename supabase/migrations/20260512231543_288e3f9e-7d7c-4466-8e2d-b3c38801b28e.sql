
-- 1. Atualiza is_editor para incluir moderador e editor
CREATE OR REPLACE FUNCTION public.is_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role,'moderador'::public.app_role,'editor'::public.app_role,'tst'::public.app_role)
  );
$$;

-- 2. Funções novas
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role,'moderador'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_viewer_or_above(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.requires_mfa(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role,'moderador'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_aal()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((auth.jwt()->>'aal')::text, 'aal1');
$$;

CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.requires_mfa(auth.uid()) OR public.current_aal() = 'aal2';
$$;

-- 3. Enum app_module + tabela user_module_access
CREATE TYPE public.app_module AS ENUM ('sesmt','estoque','producao','manutencao','portaria','usuarios');

CREATE TABLE public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module public.app_module)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_module_access
      WHERE user_id = _user_id AND module = _module AND enabled = true
    );
$$;

CREATE POLICY uma_select ON public.user_module_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY uma_admin_insert ON public.user_module_access
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

CREATE POLICY uma_admin_update ON public.user_module_access
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

CREATE POLICY uma_admin_delete ON public.user_module_access
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

-- 4. user_invites
CREATE TABLE public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'editor'::public.app_role,
  modules public.app_module[] NOT NULL DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_invites_email ON public.user_invites (lower(email)) WHERE accepted_at IS NULL;

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_invites_admin_select ON public.user_invites
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY user_invites_admin_insert ON public.user_invites
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());
CREATE POLICY user_invites_admin_update ON public.user_invites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());
CREATE POLICY user_invites_admin_delete ON public.user_invites
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

-- 5. Endurecer políticas existentes com mfa_ok()
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok())
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

DROP POLICY IF EXISTS safety_overrides_insert ON public.safety_overrides;
CREATE POLICY safety_overrides_insert ON public.safety_overrides
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND liberado_por = auth.uid() AND public.mfa_ok());

DROP POLICY IF EXISTS safety_overrides_update ON public.safety_overrides;
CREATE POLICY safety_overrides_update ON public.safety_overrides
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

DROP POLICY IF EXISTS safety_overrides_delete ON public.safety_overrides;
CREATE POLICY safety_overrides_delete ON public.safety_overrides
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

DROP POLICY IF EXISTS temp_admins_insert ON public.temp_admins;
CREATE POLICY temp_admins_insert ON public.temp_admins
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

DROP POLICY IF EXISTS temp_admins_delete ON public.temp_admins;
CREATE POLICY temp_admins_delete ON public.temp_admins
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) AND public.mfa_ok());

-- 6. Trigger aplicar convite pendente
CREATE OR REPLACE FUNCTION public.apply_pending_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.user_invites%ROWTYPE;
  v_module public.app_module;
BEGIN
  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invite.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    FOREACH v_module IN ARRAY v_invite.modules LOOP
      INSERT INTO public.user_module_access (user_id, module, enabled)
      VALUES (NEW.id, v_module, true)
      ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;
    END LOOP;

    UPDATE public.user_invites SET accepted_at = now() WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_apply_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_apply_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.apply_pending_invite();

-- 7. Backfill módulos para usuários atuais não-admin
INSERT INTO public.user_module_access (user_id, module, enabled)
SELECT ur.user_id, m::public.app_module, true
FROM public.user_roles ur
CROSS JOIN unnest(ARRAY['sesmt','estoque','producao','manutencao','portaria','usuarios']) AS m
WHERE ur.role <> 'admin'::public.app_role
ON CONFLICT (user_id, module) DO NOTHING;

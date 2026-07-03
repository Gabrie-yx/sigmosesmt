
-- =========================================================
-- 0) Amplia check de audit_logs.action pra aceitar novos verbos
-- =========================================================
DO $$
DECLARE v_conname text;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid = 'public.audit_logs'::regclass
     AND contype = 'c'
     AND conname LIKE '%action%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.audit_logs DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'INSERT','UPDATE','DELETE','READ',
    'LOGIN','LOGOUT',
    'RC_STATUS_CHANGE','RC_DISPENSA_COTACAO','RC_DISPENSA_REVOGADA','RC_DEVOLVIDA_PARA_COTACAO',
    'REATIVAR_FUNCIONARIO','REBAIXAR_ADMIN','PURGE_INVITES','FORCE_SIGNOUT',
    'MFA_ENROLL','MFA_UNENROLL'
  ));

-- =========================================================
-- 1) Anderson: admin -> moderador + supervisor_geral
-- =========================================================
DO $$
DECLARE
  v_uid uuid;
  v_company uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'anderson.soares@grupoatem.com.br';

  IF v_uid IS NULL THEN
    RAISE NOTICE 'Anderson não encontrado em auth.users — pulando';
  ELSE
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin'::public.app_role;
    INSERT INTO public.user_roles(user_id, role)
      VALUES (v_uid, 'moderador'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;

    SELECT id INTO v_company FROM public.company_settings ORDER BY created_at NULLS LAST LIMIT 1;
    IF v_company IS NOT NULL THEN
      UPDATE public.company_settings
         SET supervisor_geral_user_id = v_uid
       WHERE id = v_company;
    END IF;

    INSERT INTO public.user_module_access(user_id, module, enabled) VALUES
      (v_uid, 'sesmt'::public.app_module, true),
      (v_uid, 'producao'::public.app_module, true),
      (v_uid, 'manutencao'::public.app_module, true),
      (v_uid, 'compras'::public.app_module, true),
      (v_uid, 'estoque'::public.app_module, true),
      (v_uid, 'portaria'::public.app_module, true)
    ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;

    DELETE FROM public.user_module_access
     WHERE user_id = v_uid AND module = 'usuarios'::public.app_module;

    DELETE FROM auth.sessions WHERE user_id = v_uid;

    INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'REBAIXAR_ADMIN', 'user_roles', v_uid,
      jsonb_build_object(
        'de', 'admin',
        'para', 'moderador+supervisor_geral',
        'motivo', 'Reestruturação RBAC — Anderson opera SIGMO mas não gerencia usuários',
        'modulos_bloqueados', ARRAY['usuarios']
      ));
  END IF;
END $$;

-- =========================================================
-- 2) MFA obrigatório pra todos, com grace period de 7 dias
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_grace_until timestamptz DEFAULT (now() + interval '7 days');

UPDATE public.profiles
   SET mfa_grace_until = now() + interval '7 days'
 WHERE mfa_grace_until IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, mfa_grace_until)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    now() + interval '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.requires_mfa(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.mfa_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    NOT public.requires_mfa(auth.uid())
    OR public.current_aal() = 'aal2'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND mfa_grace_until IS NOT NULL
        AND mfa_grace_until > now()
    );
$$;

-- =========================================================
-- 3) Faxina: apaga todos os convites pendentes
-- =========================================================
DO $$
DECLARE v_qtd int;
BEGIN
  WITH del AS (
    DELETE FROM public.user_invites WHERE accepted_at IS NULL RETURNING 1
  )
  SELECT count(*) INTO v_qtd FROM del;

  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), 'PURGE_INVITES', 'user_invites', gen_random_uuid(),
    jsonb_build_object('deletados', v_qtd, 'motivo', 'Limpeza total dos convites não aceitos'));
END $$;

-- =========================================================
-- 4) Trilha de leitura — infraestrutura
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_read(
  _entity text,
  _entity_id uuid,
  _contexto jsonb DEFAULT '{}'::jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs(user_id, user_email, action, table_name, record_id, new_data)
  VALUES (auth.uid(), v_email, 'READ', _entity, _entity_id, COALESCE(_contexto, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_read(text, uuid, jsonb) TO authenticated;

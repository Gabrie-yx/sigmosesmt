-- Cria acesso temporário de investidor (viewer, 48h)
DO $$
DECLARE
  v_user_id uuid := '5f9e77eb-d775-4fe1-a3ba-22811b647bbc';
  v_email text := 'investidor.demo@sigmo.app';
  v_password text := 'Invest@Sigmo2026';
  v_expires timestamptz := now() + interval '48 hours';
  v_module app_module;
BEGIN
  -- Cria usuário em auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
    email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Investidor Demo"}'::jsonb,
    false, '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', v_user_id::text, now(), now(), now());

  -- Role viewer
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'viewer');

  -- Acesso a todos os módulos
  FOREACH v_module IN ARRAY ARRAY['sesmt','estoque','producao','manutencao','portaria','usuarios']::app_module[]
  LOOP
    INSERT INTO public.user_module_access (user_id, module, enabled)
    VALUES (v_user_id, v_module, true);
  END LOOP;

  -- Registra no temp_investors
  INSERT INTO public.temp_investors (user_id, email, expires_at)
  VALUES (v_user_id, v_email, v_expires);
END $$;

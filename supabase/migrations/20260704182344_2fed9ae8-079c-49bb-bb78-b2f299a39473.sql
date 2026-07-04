INSERT INTO public.user_roles (user_id, role)
SELECT id, 'supervisor_extra_geral'::public.app_role
FROM auth.users
WHERE email = 'anderson.soares@grupoatem.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
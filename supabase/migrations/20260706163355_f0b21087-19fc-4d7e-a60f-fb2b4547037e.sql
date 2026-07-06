
-- Módulo almoxarifado para o Israel
INSERT INTO public.user_module_access (user_id, module, enabled)
SELECT u.id, 'almoxarifado', true
FROM auth.users u
WHERE u.email = 'uchoaisrael23@gmail.com'
ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;

-- Role hora_extra_marcador para o Israel
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'hora_extra_marcador'::app_role
FROM auth.users u
WHERE u.email = 'uchoaisrael23@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

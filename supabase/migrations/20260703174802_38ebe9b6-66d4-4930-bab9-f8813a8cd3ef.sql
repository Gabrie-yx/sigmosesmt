-- Libera módulo Administrativo pro Anderson (Supervisor Geral)
INSERT INTO public.user_module_access (user_id, module, enabled)
SELECT cs.supervisor_geral_user_id, 'administrativo'::public.app_module, true
FROM public.company_settings cs
WHERE cs.supervisor_geral_user_id IS NOT NULL
ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;

-- Libera menu Requisições Recebidas pro Anderson
INSERT INTO public.user_menu_access (user_id, menu_key, enabled)
SELECT cs.supervisor_geral_user_id, '/app/administrativo/requisicoes-recebidas', true
FROM public.company_settings cs
WHERE cs.supervisor_geral_user_id IS NOT NULL
ON CONFLICT (user_id, menu_key) DO UPDATE SET enabled = true;
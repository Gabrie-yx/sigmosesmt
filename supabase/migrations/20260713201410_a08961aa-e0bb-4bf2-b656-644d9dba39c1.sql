INSERT INTO public.user_menu_access (user_id, menu_key, enabled)
SELECT DISTINCT uma.user_id, '/app/sesmt/inspecoes', true
FROM public.user_menu_access uma
JOIN public.user_module_access uma_mod
  ON uma_mod.user_id = uma.user_id
 AND uma_mod.module = 'sesmt'
 AND uma_mod.enabled = true
WHERE uma.enabled = true
  AND uma.menu_key IN (
    '/app/painel',
    '/app/sesmt/procedimentos',
    '/app/matriz-treinamento',
    '/app/sesmt/docs',
    '/app/sesmt/guia-documentos',
    '/app/sesmt/templates-documentos',
    '/app/controle-documentos',
    '/app/extintores',
    '/app/sesmt/requisicoes',
    '/app/dds',
    '/app/aprs',
    '/app/ptes',
    '/app/oss',
    '/app/trainings',
    '/app/sesmt/integracoes',
    '/app/sesmt/equipamentos-moveis',
    '/app/sesmt/terceiros',
    '/app/relatorios/reincidencia-epi',
    '/app/ncs',
    '/app/incidentes',
    '/app/acoes',
    '/app/employees',
    '/app/cascos',
    '/app/companies',
    '/app/roles',
    '/app/matriz-riscos',
    '/app/pgr',
    '/app/psicossocial'
  )
ON CONFLICT (user_id, menu_key) DO UPDATE
SET enabled = true,
    updated_at = now();
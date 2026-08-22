GRANT EXECUTE ON FUNCTION public.desativar_empresa(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reativar_empresa(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_status_empresa(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Restaura EXECUTE para authenticated nas funções auxiliares usadas pelas POLICIES de RLS.
-- Sem este grant, o Postgres rejeita a chamada feita por dentro da policy e a query devolve 0 linhas.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_viewer_or_above(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, app_module)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.requires_mfa(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_ok()                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_aal()                          TO authenticated;

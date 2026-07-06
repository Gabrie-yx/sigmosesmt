REVOKE EXECUTE ON FUNCTION public.get_hora_extra_allowed_employee_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_hora_extra_allowed_company_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.marcador_pode_marcar_employee(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_hora_extra_allowed_employee_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hora_extra_allowed_company_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcador_pode_marcar_employee(uuid, uuid) TO authenticated;

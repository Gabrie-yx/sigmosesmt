
ALTER VIEW public.v_contratada_dossie_status SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.can_approve_acordo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.expirar_acordos_vencidos() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_approve_acordo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_acordos_vencidos() TO authenticated;

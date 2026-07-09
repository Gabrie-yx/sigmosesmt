
-- Trigger genérico de auditoria para os catálogos SST
CREATE OR REPLACE FUNCTION public.audit_catalogo_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_record_id uuid;
BEGIN
  v_user_id := auth.uid();
  BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_record_id := (OLD.id)::uuid;
    INSERT INTO public.audit_logs (table_name, action, record_id, user_id, user_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'DELETE', v_record_id, v_user_id, v_user_email, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := (NEW.id)::uuid;
    INSERT INTO public.audit_logs (table_name, action, record_id, user_id, user_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'UPDATE', v_record_id, v_user_id, v_user_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := (NEW.id)::uuid;
    INSERT INTO public.audit_logs (table_name, action, record_id, user_id, user_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'INSERT', v_record_id, v_user_id, v_user_email, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Aplicar nos catálogos existentes
DROP TRIGGER IF EXISTS audit_catalogo_riscos_trg ON public.catalogo_riscos;
CREATE TRIGGER audit_catalogo_riscos_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.catalogo_riscos
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalogo_trigger();

DROP TRIGGER IF EXISTS audit_catalogo_nrs_trg ON public.catalogo_nrs;
CREATE TRIGGER audit_catalogo_nrs_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.catalogo_nrs
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalogo_trigger();

DROP TRIGGER IF EXISTS audit_exam_catalog_trg ON public.exam_catalog;
CREATE TRIGGER audit_exam_catalog_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_catalog
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalogo_trigger();

DROP TRIGGER IF EXISTS audit_catalogo_gases_trg ON public.catalogo_gases_atmosfericos;
CREATE TRIGGER audit_catalogo_gases_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.catalogo_gases_atmosfericos
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalogo_trigger();

DROP TRIGGER IF EXISTS audit_risco_exames_trg ON public.risco_exames;
CREATE TRIGGER audit_risco_exames_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.risco_exames
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalogo_trigger();

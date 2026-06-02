CREATE OR REPLACE FUNCTION public.sync_employee_tipo_vinculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_type TEXT;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.tipo_vinculo := 'PROPRIO';
    RETURN NEW;
  END IF;

  SELECT type INTO v_company_type FROM public.companies WHERE id = NEW.company_id;

  NEW.tipo_vinculo := CASE WHEN v_company_type = 'TERCEIRIZADO' THEN 'TERCEIRO' ELSE 'PROPRIO' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_tipo_vinculo ON public.employees;
CREATE TRIGGER trg_sync_employee_tipo_vinculo
  BEFORE INSERT OR UPDATE OF company_id ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_tipo_vinculo();

-- Backfill
UPDATE public.employees e
SET tipo_vinculo = CASE WHEN c.type = 'TERCEIRIZADO' THEN 'TERCEIRO' ELSE 'PROPRIO' END
FROM public.companies c
WHERE e.company_id = c.id
  AND e.tipo_vinculo IS DISTINCT FROM (CASE WHEN c.type = 'TERCEIRIZADO' THEN 'TERCEIRO' ELSE 'PROPRIO' END);
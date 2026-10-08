CREATE OR REPLACE FUNCTION public.cascos_auto_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _next int;
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('cascos_auto_numero'));
    SELECT COALESCE(MAX((regexp_match(numero, '^LT-(\d+)$'))[1]::int), 0) + 1 INTO _next FROM public.cascos;
    NEW.numero := 'LT-' || lpad(_next::text, 4, '0');
  ELSE
    NEW.numero := btrim(NEW.numero);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cascos_auto_numero ON public.cascos;
CREATE TRIGGER trg_cascos_auto_numero BEFORE INSERT ON public.cascos
FOR EACH ROW EXECUTE FUNCTION public.cascos_auto_numero();
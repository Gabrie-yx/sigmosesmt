CREATE OR REPLACE FUNCTION public.set_numero_nc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_tnc();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_numero_nc() FROM PUBLIC, anon, authenticated;
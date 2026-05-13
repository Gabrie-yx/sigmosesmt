ALTER TABLE public.apr_riscos ADD COLUMN IF NOT EXISTS passo_a_passo text;
ALTER TABLE public.aprs ADD COLUMN IF NOT EXISTS dias_semana text[] DEFAULT ARRAY['SEG','TER','QUA','QUI','SEX']::text[];

CREATE OR REPLACE FUNCTION public.peek_proximo_numero_apr()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  ano text := to_char(now(), 'YYYY');
  ult int;
BEGIN
  SELECT COALESCE(MAX((split_part(numero,'/',1))::int),0) INTO ult
  FROM public.aprs WHERE numero LIKE '%/' || ano;
  RETURN lpad((ult+1)::text, 2, '0') || '/' || ano;
END $$;

GRANT EXECUTE ON FUNCTION public.peek_proximo_numero_apr() TO authenticated, anon;
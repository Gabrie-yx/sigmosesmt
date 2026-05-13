-- Atualiza geração e pré-visualização do número da APR para o formato NNNNN+MM+AA (ex.: 000010526)
CREATE OR REPLACE FUNCTION public.gerar_numero_apr()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano2 TEXT := to_char(CURRENT_DATE, 'YY');
  v_mes2 TEXT := to_char(CURRENT_DATE, 'MM');
  v_suffix TEXT := v_mes2 || v_ano2; -- 4 últimos dígitos: MMAA
  v_seq INT;
BEGIN
  -- Sequencial dentro do mês/ano corrente
  SELECT COALESCE(MAX( substring(numero from '^(\d{5})' )::INT ), 0) + 1
    INTO v_seq
    FROM public.aprs
   WHERE numero ~ ('^\d{5}' || v_suffix || '$');
  RETURN lpad(v_seq::TEXT, 5, '0') || v_suffix;
END;
$$;

CREATE OR REPLACE FUNCTION public.peek_proximo_numero_apr()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano2 TEXT := to_char(CURRENT_DATE, 'YY');
  v_mes2 TEXT := to_char(CURRENT_DATE, 'MM');
  v_suffix TEXT := v_mes2 || v_ano2;
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX( substring(numero from '^(\d{5})' )::INT ), 0) + 1
    INTO v_seq
    FROM public.aprs
   WHERE numero ~ ('^\d{5}' || v_suffix || '$');
  RETURN lpad(v_seq::TEXT, 5, '0') || v_suffix;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_proximo_numero_apr() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.gerar_numero_apr() TO authenticated;

ALTER TABLE public.producao_ordens
  ADD COLUMN IF NOT EXISTS casco text,
  ADD COLUMN IF NOT EXISTS tipo_produto text,
  ADD COLUMN IF NOT EXISTS solicitante text,
  ADD COLUMN IF NOT EXISTS qtde_itens integer;

CREATE OR REPLACE FUNCTION public.gerar_numero_ordem_producao()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano4 text := to_char(CURRENT_DATE, 'YYYY');
  v_seq int;
BEGIN
  SELECT COALESCE(MAX( substring(numero from '^OP-(\d+)/')::int ), 0) + 1
    INTO v_seq
    FROM public.producao_ordens
   WHERE numero ~ ('^OP-\d+/' || v_ano4 || '$');
  RETURN 'OP-' || lpad(v_seq::text, 4, '0') || '/' || v_ano4;
END;
$$;

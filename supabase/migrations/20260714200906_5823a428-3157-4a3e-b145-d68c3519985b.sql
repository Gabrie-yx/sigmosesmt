
CREATE TABLE IF NOT EXISTS public.pte_numero_sequencia (
  tipo text NOT NULL,
  ano int NOT NULL,
  ultimo int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, ano)
);
GRANT SELECT ON public.pte_numero_sequencia TO authenticated;
GRANT ALL ON public.pte_numero_sequencia TO service_role;
ALTER TABLE public.pte_numero_sequencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leitura_autenticados" ON public.pte_numero_sequencia;
CREATE POLICY "leitura_autenticados" ON public.pte_numero_sequencia FOR SELECT TO authenticated USING (true);

-- Semeia a sequência do ano corrente com o maior número já existente por tipo
-- (evita começar do zero se já houver PTEs no ano com números aleatórios/altos).
INSERT INTO public.pte_numero_sequencia (tipo, ano, ultimo)
SELECT tipo_pt, EXTRACT(YEAR FROM data_emissao)::int AS ano,
       COALESCE(MAX(
         CASE WHEN numero ~ ('^' || tipo_pt || '-\d{4}-\d+$')
              THEN (regexp_replace(numero, '^.*-', ''))::int
              ELSE 0 END
       ), 0)
FROM public.ptes
WHERE tipo_pt IS NOT NULL AND data_emissao IS NOT NULL
GROUP BY tipo_pt, EXTRACT(YEAR FROM data_emissao)
ON CONFLICT (tipo, ano) DO UPDATE
  SET ultimo = GREATEST(pte_numero_sequencia.ultimo, EXCLUDED.ultimo);

CREATE OR REPLACE FUNCTION public.proximo_numero_pte(_tipo text, _ano int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next int;
BEGIN
  IF _tipo IS NULL OR length(_tipo) = 0 THEN
    RAISE EXCEPTION 'tipo de PT é obrigatório';
  END IF;
  INSERT INTO public.pte_numero_sequencia (tipo, ano, ultimo)
  VALUES (_tipo, _ano, 1)
  ON CONFLICT (tipo, ano) DO UPDATE
    SET ultimo = pte_numero_sequencia.ultimo + 1, updated_at = now()
  RETURNING ultimo INTO _next;
  RETURN _tipo || '-' || _ano || '-' || LPAD(_next::text, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.proximo_numero_pte(text, int) TO authenticated;


-- Função que busca passo_a_passo no catálogo de modelos
CREATE OR REPLACE FUNCTION public.apr_risco_fill_passo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_passo text;
BEGIN
  IF NEW.passo_a_passo IS NOT NULL AND length(btrim(NEW.passo_a_passo)) > 0 THEN
    RETURN NEW;
  END IF;

  -- 1) Match por risco_nome + acoes_preventivas
  SELECT (r->>'passo_a_passo') INTO v_passo
  FROM public.apr_modelos m, jsonb_array_elements(m.riscos) r
  WHERE lower(btrim(r->>'risco_nome')) = lower(btrim(COALESCE(NEW.risco_nome,'')))
    AND lower(btrim(r->>'acoes_preventivas')) = lower(btrim(COALESCE(NEW.acoes_preventivas,'')))
    AND (r->>'passo_a_passo') IS NOT NULL
  LIMIT 1;

  -- 2) Fallback: só pelo risco_nome
  IF v_passo IS NULL THEN
    SELECT (r->>'passo_a_passo') INTO v_passo
    FROM public.apr_modelos m, jsonb_array_elements(m.riscos) r
    WHERE lower(btrim(r->>'risco_nome')) = lower(btrim(COALESCE(NEW.risco_nome,'')))
      AND (r->>'passo_a_passo') IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_passo IS NOT NULL THEN
    NEW.passo_a_passo := v_passo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apr_risco_fill_passo ON public.apr_riscos;
CREATE TRIGGER trg_apr_risco_fill_passo
BEFORE INSERT OR UPDATE ON public.apr_riscos
FOR EACH ROW
EXECUTE FUNCTION public.apr_risco_fill_passo();

-- Backfill: corrige TODOS os riscos existentes (inclusive os que estão com texto errado, vindo de outro risco)
WITH match AS (
  SELECT ar.id,
         COALESCE(
           (SELECT (r->>'passo_a_passo')
              FROM public.apr_modelos m, jsonb_array_elements(m.riscos) r
             WHERE lower(btrim(r->>'risco_nome')) = lower(btrim(COALESCE(ar.risco_nome,'')))
               AND lower(btrim(r->>'acoes_preventivas')) = lower(btrim(COALESCE(ar.acoes_preventivas,'')))
               AND (r->>'passo_a_passo') IS NOT NULL
             LIMIT 1),
           (SELECT (r->>'passo_a_passo')
              FROM public.apr_modelos m, jsonb_array_elements(m.riscos) r
             WHERE lower(btrim(r->>'risco_nome')) = lower(btrim(COALESCE(ar.risco_nome,'')))
               AND (r->>'passo_a_passo') IS NOT NULL
             LIMIT 1)
         ) AS novo_passo
    FROM public.apr_riscos ar
)
UPDATE public.apr_riscos ar
   SET passo_a_passo = m.novo_passo
  FROM match m
 WHERE ar.id = m.id
   AND m.novo_passo IS NOT NULL
   AND (ar.passo_a_passo IS DISTINCT FROM m.novo_passo);

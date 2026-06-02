-- Trigger pra classificar risco AIHA automaticamente
CREATE OR REPLACE FUNCTION public.pgr_inventario_set_classificacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r INT;
BEGIN
  IF NEW.probabilidade IS NULL OR NEW.severidade IS NULL THEN
    NEW.classificacao := NULL;
    RETURN NEW;
  END IF;
  r := NEW.probabilidade * NEW.severidade;
  NEW.classificacao := CASE
    WHEN r <=  3 THEN 'TRIVIAL'
    WHEN r <=  6 THEN 'BAIXO'
    WHEN r <= 10 THEN 'MODERADO'
    WHEN r <= 15 THEN 'ALTO'
    ELSE 'MUITO_ALTO'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pgr_inventario_classificacao ON public.pgr_inventario_riscos;
CREATE TRIGGER trg_pgr_inventario_classificacao
BEFORE INSERT OR UPDATE OF probabilidade, severidade
ON public.pgr_inventario_riscos
FOR EACH ROW EXECUTE FUNCTION public.pgr_inventario_set_classificacao();

-- Backfill nos registros existentes
UPDATE public.pgr_inventario_riscos
   SET classificacao = CASE
     WHEN probabilidade IS NULL OR severidade IS NULL THEN NULL
     WHEN probabilidade * severidade <=  3 THEN 'TRIVIAL'
     WHEN probabilidade * severidade <=  6 THEN 'BAIXO'
     WHEN probabilidade * severidade <= 10 THEN 'MODERADO'
     WHEN probabilidade * severidade <= 15 THEN 'ALTO'
     ELSE 'MUITO_ALTO'
   END
 WHERE classificacao IS NULL;
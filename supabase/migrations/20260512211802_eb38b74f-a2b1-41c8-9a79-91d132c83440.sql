-- 1) Campo GERAIS editável
ALTER TABLE public.aprs ADD COLUMN IF NOT EXISTS texto_gerais text;

-- 2) Recriar nivel_risco como P+S (era P*S gerada)
ALTER TABLE public.apr_riscos DROP COLUMN IF EXISTS nivel_risco;

-- 3) Migrar P/S existentes para escala 1-3
UPDATE public.apr_riscos
   SET probabilidade = LEAST(GREATEST(probabilidade, 1), 3),
       severidade   = LEAST(GREATEST(severidade, 1), 3);

-- 4) Constraints da nova escala
ALTER TABLE public.apr_riscos DROP CONSTRAINT IF EXISTS apr_riscos_prob_check;
ALTER TABLE public.apr_riscos DROP CONSTRAINT IF EXISTS apr_riscos_sev_check;
ALTER TABLE public.apr_riscos
  ADD CONSTRAINT apr_riscos_prob_check CHECK (probabilidade BETWEEN 1 AND 3);
ALTER TABLE public.apr_riscos
  ADD CONSTRAINT apr_riscos_sev_check  CHECK (severidade BETWEEN 1 AND 3);

-- 5) Recriar nivel_risco como soma P+S
ALTER TABLE public.apr_riscos
  ADD COLUMN nivel_risco int GENERATED ALWAYS AS (probabilidade + severidade) STORED;
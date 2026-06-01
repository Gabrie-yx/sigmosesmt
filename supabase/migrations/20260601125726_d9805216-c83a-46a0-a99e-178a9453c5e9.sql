-- Vincular APR a modelo de origem (rastreabilidade + matriz de cobertura)
ALTER TABLE public.aprs ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES public.apr_modelos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_aprs_modelo_id ON public.aprs(modelo_id);
CREATE INDEX IF NOT EXISTS idx_aprs_casco_id ON public.aprs(casco_id);
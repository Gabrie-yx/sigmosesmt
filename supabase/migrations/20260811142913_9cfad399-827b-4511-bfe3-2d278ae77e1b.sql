ALTER TABLE public.hht_mensal ADD COLUMN IF NOT EXISTS empregados_medio INTEGER DEFAULT 0;
COMMENT ON COLUMN public.hht_mensal.empregados_medio IS 'Número médio de empregados no mês para cálculo do Quadro Estatístico';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hht_mensal TO authenticated;
GRANT ALL ON public.hht_mensal TO service_role;

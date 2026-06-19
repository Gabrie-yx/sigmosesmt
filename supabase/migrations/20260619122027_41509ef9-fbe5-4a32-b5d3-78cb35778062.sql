
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS meta_dds_semana INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS meta_dds_dias_semana INT[] NOT NULL DEFAULT ARRAY[1,3,5],
  ADD COLUMN IF NOT EXISTS meta_inspecoes_pct INT NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS meta_treinamentos_pct INT NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS meta_aso_pct INT NOT NULL DEFAULT 95,
  ADD COLUMN IF NOT EXISTS meta_acidentes_taxa_max_pct NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS meta_dias_perdidos_max_mes INT NOT NULL DEFAULT 5;

-- Garante INSERT/UPDATE para authenticated (policy "admin gerencia" já filtra por role admin)
GRANT INSERT, UPDATE ON public.company_settings TO authenticated;

-- Garante 1 linha existente
INSERT INTO public.company_settings (pt_exige_apr_valida)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

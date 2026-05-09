ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS req_exames text[] NOT NULL DEFAULT '{}'::text[];

-- Seed Soldador role with required exams if it exists
UPDATE public.roles
SET req_exames = ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT']
WHERE lower(name) LIKE '%soldador%' AND (req_exames IS NULL OR array_length(req_exames,1) IS NULL);
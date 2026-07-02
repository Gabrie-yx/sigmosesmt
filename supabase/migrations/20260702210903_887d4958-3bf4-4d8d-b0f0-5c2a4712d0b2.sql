
-- Garante existência de ao menos uma linha de company_settings
INSERT INTO public.company_settings (supervisor_geral_user_id)
SELECT 'e97b68f2-6d1c-4872-b0af-1a58a010de0b'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- Atualiza (se já existia) — pega a linha mais antiga como singleton
UPDATE public.company_settings
   SET supervisor_geral_user_id = 'e97b68f2-6d1c-4872-b0af-1a58a010de0b'::uuid
 WHERE id = (SELECT id FROM public.company_settings ORDER BY created_at ASC LIMIT 1);

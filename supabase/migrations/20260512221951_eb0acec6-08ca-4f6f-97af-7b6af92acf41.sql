ALTER TABLE public.aprs
  ADD COLUMN IF NOT EXISTS hora_inicio_sexta TIME NULL,
  ADD COLUMN IF NOT EXISTS hora_fim_sexta TIME NULL;
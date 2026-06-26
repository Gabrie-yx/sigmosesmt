ALTER TABLE public.hora_extra_sabado
  ADD COLUMN IF NOT EXISTS assinatura_tst_data text,
  ADD COLUMN IF NOT EXISTS assinatura_gestor_data text;
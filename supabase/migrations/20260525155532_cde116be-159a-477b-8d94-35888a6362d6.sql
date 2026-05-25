ALTER TABLE public.aprs
  ADD COLUMN IF NOT EXISTS signature_tst text,
  ADD COLUMN IF NOT EXISTS signature_tst_height integer,
  ADD COLUMN IF NOT EXISTS signature_enc text,
  ADD COLUMN IF NOT EXISTS signature_enc_height integer;
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS responsavel_tst text,
  ADD COLUMN IF NOT EXISTS responsavel_aprovador text;
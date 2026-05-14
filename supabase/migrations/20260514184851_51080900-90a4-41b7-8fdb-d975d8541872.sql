ALTER TABLE public.purchase_requisitions
ADD COLUMN IF NOT EXISTS signature_solicitante TEXT,
ADD COLUMN IF NOT EXISTS signature_solicitante_height INTEGER;
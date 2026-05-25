ALTER TABLE public.ptes ADD COLUMN casco_id uuid REFERENCES public.cascos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ptes_casco_id ON public.ptes(casco_id);
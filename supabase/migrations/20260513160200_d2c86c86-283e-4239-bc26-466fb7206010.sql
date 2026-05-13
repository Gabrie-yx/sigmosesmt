ALTER TABLE public.ptes ADD COLUMN IF NOT EXISTS apr_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_ptes_apr_id ON public.ptes(apr_id);
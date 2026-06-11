ALTER TABLE public.documentos_assinados 
ADD COLUMN IF NOT EXISTS original_pdf_path TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'signed',
ADD COLUMN IF NOT EXISTS placements_draft JSONB DEFAULT '[]'::jsonb;

-- Atualizar registros existentes para 'signed'
UPDATE public.documentos_assinados SET status = 'signed' WHERE status IS NULL;
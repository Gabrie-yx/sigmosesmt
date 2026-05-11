
-- Tabela de documentos SESMT (PGR, PCMSO, LTCAT, etc)
CREATE TABLE public.sesmt_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT,
  descricao TEXT,
  file_path TEXT NOT NULL,
  data_emissao DATE,
  data_validade DATE,
  company_id UUID,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sesmt_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sesmt_documents_select" ON public.sesmt_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sesmt_documents_insert" ON public.sesmt_documents
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));

CREATE POLICY "sesmt_documents_update" ON public.sesmt_documents
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));

CREATE POLICY "sesmt_documents_delete" ON public.sesmt_documents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_sesmt_documents_tipo ON public.sesmt_documents(tipo);
CREATE INDEX idx_sesmt_documents_uploaded_at ON public.sesmt_documents(uploaded_at DESC);

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('sesmt-docs', 'sesmt-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sesmt_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'sesmt-docs');

CREATE POLICY "sesmt_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sesmt-docs' AND is_editor(auth.uid()));

CREATE POLICY "sesmt_docs_storage_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'sesmt-docs' AND is_editor(auth.uid()));

CREATE POLICY "sesmt_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'sesmt-docs' AND has_role(auth.uid(), 'admin'::app_role));

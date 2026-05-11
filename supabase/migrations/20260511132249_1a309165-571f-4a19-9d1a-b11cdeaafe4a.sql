CREATE TABLE public.sesmt_document_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.sesmt_documents(id) ON DELETE CASCADE,
  data_revisao DATE NOT NULL,
  numero_revisao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  motivo TEXT,
  responsavel TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sesmt_doc_revisions_doc ON public.sesmt_document_revisions(document_id, data_revisao DESC);

ALTER TABLE public.sesmt_document_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sesmt_doc_revisions_select" ON public.sesmt_document_revisions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sesmt_doc_revisions_insert" ON public.sesmt_document_revisions
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "sesmt_doc_revisions_update" ON public.sesmt_document_revisions
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));

CREATE POLICY "sesmt_doc_revisions_delete" ON public.sesmt_document_revisions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
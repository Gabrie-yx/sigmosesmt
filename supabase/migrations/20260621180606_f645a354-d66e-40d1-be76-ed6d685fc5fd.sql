
CREATE TABLE public.incidente_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incidente_id UUID NOT NULL REFERENCES public.incidentes(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  tipo TEXT,
  descricao TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidente_evidencias TO authenticated;
GRANT ALL ON public.incidente_evidencias TO service_role;
ALTER TABLE public.incidente_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidente_evidencias select" ON public.incidente_evidencias FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "incidente_evidencias insert" ON public.incidente_evidencias FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "incidente_evidencias update" ON public.incidente_evidencias FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "incidente_evidencias delete" ON public.incidente_evidencias FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_incidente_evidencias_incidente_id ON public.incidente_evidencias(incidente_id);

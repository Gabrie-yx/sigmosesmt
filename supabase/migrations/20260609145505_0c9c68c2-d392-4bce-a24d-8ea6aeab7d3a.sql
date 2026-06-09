
CREATE TABLE public.epi_fichas_mensais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  total_entregas INT NOT NULL DEFAULT 0,
  arquivo_assinado_path TEXT,
  uploaded_at TIMESTAMPTZ,
  uploaded_by UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, ano, mes)
);

CREATE INDEX idx_epi_fichas_mensais_emp ON public.epi_fichas_mensais(employee_id);
CREATE INDEX idx_epi_fichas_mensais_periodo ON public.epi_fichas_mensais(ano, mes);
CREATE INDEX idx_epi_fichas_mensais_status ON public.epi_fichas_mensais(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_fichas_mensais TO authenticated;
GRANT ALL ON public.epi_fichas_mensais TO service_role;

ALTER TABLE public.epi_fichas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers can read fichas mensais"
  ON public.epi_fichas_mensais FOR SELECT
  TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editors can insert fichas mensais"
  ON public.epi_fichas_mensais FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "editors can update fichas mensais"
  ON public.epi_fichas_mensais FOR UPDATE
  TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "admins can delete fichas mensais"
  ON public.epi_fichas_mensais FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_epi_fichas_mensais_updated_at
  BEFORE UPDATE ON public.epi_fichas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "editors read epi fichas mensais bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'epi-fichas-mensais' AND public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editors upload epi fichas mensais bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'epi-fichas-mensais' AND public.is_editor(auth.uid()));

CREATE POLICY "editors update epi fichas mensais bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'epi-fichas-mensais' AND public.is_editor(auth.uid()));

CREATE POLICY "admins delete epi fichas mensais bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'epi-fichas-mensais' AND public.has_role(auth.uid(), 'admin'::public.app_role));

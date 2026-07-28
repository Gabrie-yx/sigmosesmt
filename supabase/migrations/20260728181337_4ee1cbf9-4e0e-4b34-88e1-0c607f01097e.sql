
CREATE TABLE public.pgr_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL,
  descricao TEXT,
  data_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'VIGENTE',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_versoes TO authenticated;
GRANT ALL ON public.pgr_versoes TO service_role;

ALTER TABLE public.pgr_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pgr_versoes_select" ON public.pgr_versoes
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "pgr_versoes_insert" ON public.pgr_versoes
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "pgr_versoes_update" ON public.pgr_versoes
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "pgr_versoes_delete" ON public.pgr_versoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX pgr_versoes_uma_vigente
  ON public.pgr_versoes ((status)) WHERE status = 'VIGENTE';

CREATE TRIGGER update_pgr_versoes_updated_at
  BEFORE UPDATE ON public.pgr_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pgr_versoes (numero, descricao, data_vigencia, status, observacao)
VALUES ('Rev. 05', 'Revisão vigente registrada como marco inicial da rastreabilidade da OS.',
        CURRENT_DATE, 'VIGENTE',
        'Criada automaticamente na implantação do vínculo OS <-> PGR. Ajuste número e data conforme o documento oficial.');

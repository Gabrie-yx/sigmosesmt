CREATE TABLE IF NOT EXISTS public.producao_classes_avaliacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.producao_classes_avaliacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers leem classes avaliacao" ON public.producao_classes_avaliacao
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editores gerenciam classes avaliacao" ON public.producao_classes_avaliacao
  FOR ALL TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE TRIGGER set_updated_at_classes_avaliacao
  BEFORE UPDATE ON public.producao_classes_avaliacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.producao_classes_avaliacao (codigo) VALUES ('7900'), ('7903'), ('7921')
  ON CONFLICT (codigo) DO NOTHING;
CREATE TABLE public.assinaturas_salvas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  imagem_data_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas_salvas TO authenticated;
GRANT ALL ON public.assinaturas_salvas TO service_role;

ALTER TABLE public.assinaturas_salvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logados veem assinaturas"
  ON public.assinaturas_salvas FOR SELECT
  TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editores cadastram assinaturas"
  ON public.assinaturas_salvas FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Editores atualizam assinaturas"
  ON public.assinaturas_salvas FOR UPDATE
  TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Editores removem assinaturas"
  ON public.assinaturas_salvas FOR DELETE
  TO authenticated
  USING (public.is_editor(auth.uid()));

CREATE TRIGGER assinaturas_salvas_set_updated_at
  BEFORE UPDATE ON public.assinaturas_salvas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX assinaturas_salvas_nome_idx ON public.assinaturas_salvas (nome);
CREATE TABLE public.producao_grupo_mercadorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producao_grupo_mercadorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgm_select ON public.producao_grupo_mercadorias FOR SELECT TO authenticated USING (true);
CREATE POLICY pgm_insert ON public.producao_grupo_mercadorias FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY pgm_update ON public.producao_grupo_mercadorias FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY pgm_delete ON public.producao_grupo_mercadorias FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.producao_grupo_mercadorias (codigo) VALUES
  ('AT0005'),('AT0022'),('AT0023'),('AT0024'),('AT0034'),('AT0035')
ON CONFLICT (codigo) DO NOTHING;

-- Tipos de Produto (módulo Produção)
CREATE TABLE IF NOT EXISTS public.producao_tipos_produto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producao_tipos_produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_select ON public.producao_tipos_produto FOR SELECT TO authenticated USING (true);
CREATE POLICY tp_insert ON public.producao_tipos_produto FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY tp_update ON public.producao_tipos_produto FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY tp_delete ON public.producao_tipos_produto FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.producao_tipos_produto (nome) VALUES
  ('ESTRUTURA FLUTUANTE'),('BALSA'),('EMPURRADOR'),('EMBARCAÇÃO')
ON CONFLICT (nome) DO NOTHING;

-- Unidades de Medida
CREATE TABLE IF NOT EXISTS public.producao_unidades_medida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producao_unidades_medida ENABLE ROW LEVEL SECURITY;
CREATE POLICY um_select ON public.producao_unidades_medida FOR SELECT TO authenticated USING (true);
CREATE POLICY um_insert ON public.producao_unidades_medida FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY um_update ON public.producao_unidades_medida FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY um_delete ON public.producao_unidades_medida FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.producao_unidades_medida (sigla, descricao) VALUES ('UN','Unidade')
ON CONFLICT (sigla) DO NOTHING;

-- Cascos: garantir registros 069..141 (exceto 138, 139 não na lista; mas inserir os solicitados)
INSERT INTO public.cascos (numero, status) VALUES
('CASCO 069','ATIVO'),('CASCO 070','ATIVO'),('CASCO 071','ATIVO'),('CASCO 072','ATIVO'),
('CASCO 079','ATIVO'),('CASCO 080','ATIVO'),('CASCO 081','ATIVO'),('CASCO 082','ATIVO'),
('CASCO 083','ATIVO'),('CASCO 084','ATIVO'),('CASCO 085','ATIVO'),('CASCO 086','ATIVO'),
('CASCO 087','ATIVO'),('CASCO 093','ATIVO'),('CASCO 094','ATIVO'),('CASCO 096','ATIVO'),
('CASCO 097','ATIVO'),('CASCO 101','ATIVO'),('CASCO 102','ATIVO'),('CASCO 103','ATIVO'),
('CASCO 104','ATIVO'),('CASCO 105','ATIVO'),('CASCO 119','ATIVO'),('CASCO 120','ATIVO'),
('CASCO 121','ATIVO'),('CASCO 122','ATIVO'),('CASCO 126','ATIVO'),('CASCO 127','ATIVO'),
('CASCO 130','ATIVO'),('CASCO 131','ATIVO'),('CASCO 132','ATIVO'),('CASCO 133','ATIVO'),
('CASCO 134','ATIVO'),('CASCO 135','ATIVO'),('CASCO 136','ATIVO'),('CASCO 137','ATIVO'),
('CASCO 140','ATIVO'),('CASCO 141','ATIVO')
ON CONFLICT (numero) DO NOTHING;

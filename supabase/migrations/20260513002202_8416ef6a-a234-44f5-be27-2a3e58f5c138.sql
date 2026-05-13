-- 1) Embarcações da Produção
CREATE TABLE IF NOT EXISTS public.producao_embarcacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  numero_casco TEXT,
  tipo TEXT NOT NULL DEFAULT 'OUTRO',
  ncm TEXT,
  status TEXT NOT NULL DEFAULT 'EM_PRODUCAO',
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.producao_embarcacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pe_select ON public.producao_embarcacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY pe_insert ON public.producao_embarcacoes FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY pe_update ON public.producao_embarcacoes FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY pe_delete ON public.producao_embarcacoes FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_pe_upd BEFORE UPDATE ON public.producao_embarcacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Catálogo de Materiais (HALB / FERT)
CREATE TABLE IF NOT EXISTS public.producao_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_material TEXT NOT NULL UNIQUE,
  tipo_material TEXT NOT NULL CHECK (tipo_material IN ('HALB','FERT')),
  ncm TEXT,
  descricao TEXT NOT NULL,
  embarcacao_id UUID REFERENCES public.producao_embarcacoes(id) ON DELETE SET NULL,
  tipo_embarcacao TEXT,
  grupo_mercadorias TEXT,
  umb TEXT DEFAULT 'UN',
  grupo_compradores TEXT,
  classe_avaliacao TEXT,
  controle_preco TEXT,
  unidade_preco NUMERIC,
  centro TEXT,
  deposito TEXT,
  org_vendas TEXT,
  canal_distribuicao TEXT,
  setor_atividade TEXT,
  grupo_categ_item TEXT,
  determ_preco TEXT,
  data_solicitacao DATE,
  item_solicitacao INT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.producao_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_select ON public.producao_materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY pm_insert ON public.producao_materiais FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY pm_update ON public.producao_materiais FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY pm_delete ON public.producao_materiais FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_pm_upd BEFORE UPDATE ON public.producao_materiais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_pm_tipo ON public.producao_materiais(tipo_material);
CREATE INDEX idx_pm_emb ON public.producao_materiais(embarcacao_id);
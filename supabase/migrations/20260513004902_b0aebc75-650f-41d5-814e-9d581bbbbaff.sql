-- Tabela cabeçalho da Ordem de Produção
CREATE TABLE public.producao_ordens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  embarcacao_id UUID REFERENCES public.producao_embarcacoes(id) ON DELETE SET NULL,
  tipo_ordem TEXT NOT NULL DEFAULT 'MISTA', -- HALB | FERT | MISTA
  codigo_formulario TEXT NOT NULL DEFAULT 'FOR-PROD 01',
  revisao TEXT NOT NULL DEFAULT '00',
  pagina TEXT NOT NULL DEFAULT '01/01',
  status TEXT NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO | EMITIDA | EM_PRODUCAO | CONCLUIDA | CANCELADA
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.producao_ordens ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_select ON public.producao_ordens FOR SELECT TO authenticated USING (true);
CREATE POLICY po_insert ON public.producao_ordens FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY po_update ON public.producao_ordens FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY po_delete ON public.producao_ordens FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_producao_ordens_updated
  BEFORE UPDATE ON public.producao_ordens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela linhas/itens da Ordem (espelha colunas da planilha FOR-PROD 01)
CREATE TABLE public.producao_ordem_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_id UUID NOT NULL REFERENCES public.producao_ordens(id) ON DELETE CASCADE,
  item INTEGER NOT NULL,
  data_solicitacao DATE,
  descricao_material TEXT NOT NULL,
  unidade_medida TEXT DEFAULT 'UN',
  grupo_compradores TEXT,
  ncm TEXT,
  centro TEXT,
  deposito TEXT,
  grupo_mercadorias TEXT,
  setor_atividade TEXT,
  grupo_categ_item_ger TEXT DEFAULT 'NORM',
  classe_avaliacao TEXT,
  determ_preco TEXT,
  controle_preco TEXT,
  origem_material TEXT, -- NACIONAL | IMPORTADO
  utilizacao_material TEXT, -- INDUSTRIALIZAÇÃO | REVENDA etc
  codigo_sap TEXT,
  ocorrencia TEXT,
  material_id UUID REFERENCES public.producao_materiais(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_ordem ON public.producao_ordem_itens(ordem_id);

ALTER TABLE public.producao_ordem_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY poi_select ON public.producao_ordem_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY poi_insert ON public.producao_ordem_itens FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY poi_update ON public.producao_ordem_itens FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY poi_delete ON public.producao_ordem_itens FOR DELETE TO authenticated USING (is_editor(auth.uid()));

CREATE TRIGGER trg_producao_ordem_itens_updated
  BEFORE UPDATE ON public.producao_ordem_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
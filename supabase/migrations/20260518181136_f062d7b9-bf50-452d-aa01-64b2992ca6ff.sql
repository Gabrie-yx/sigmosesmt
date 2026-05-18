-- Cabeçalho da Lista Técnica (1 importação = 1 versão por casco)
CREATE TABLE public.producao_lista_tecnica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casco_id UUID NOT NULL,
  tipo_embarcacao TEXT,
  origem TEXT NOT NULL DEFAULT 'B51',
  arquivo_nome TEXT,
  versao INTEGER NOT NULL DEFAULT 1,
  peso_total_estimado NUMERIC(14,2),
  peso_total_real NUMERIC(14,2),
  qtd_itens INTEGER NOT NULL DEFAULT 0,
  qtd_codigos_distintos INTEGER NOT NULL DEFAULT 0,
  qtd_pecas_total INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  importado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plt_casco ON public.producao_lista_tecnica(casco_id, versao DESC);

ALTER TABLE public.producao_lista_tecnica ENABLE ROW LEVEL SECURITY;

CREATE POLICY plt_select ON public.producao_lista_tecnica FOR SELECT TO authenticated USING (true);
CREATE POLICY plt_insert ON public.producao_lista_tecnica FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY plt_update ON public.producao_lista_tecnica FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY plt_delete ON public.producao_lista_tecnica FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_plt_updated_at
  BEFORE UPDATE ON public.producao_lista_tecnica
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens da Lista Técnica (linha a linha do arquivo SAP B51)
CREATE TABLE public.producao_lista_tecnica_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID NOT NULL REFERENCES public.producao_lista_tecnica(id) ON DELETE CASCADE,
  linha INTEGER NOT NULL,
  codigo_sap TEXT NOT NULL,
  descricao_sap TEXT,
  elemento TEXT,
  medida TEXT,
  unidade TEXT,
  peso_unit_ref NUMERIC(12,3),
  quantidade NUMERIC(14,3),
  peso_total_estimado NUMERIC(14,3),
  largura_txt TEXT,
  largura_m NUMERIC(10,3),
  comprimento_txt TEXT,
  comprimento_m NUMERIC(10,3),
  peso_chapa NUMERIC(12,3),
  espessura_mm NUMERIC(8,2),
  qtd_pecas INTEGER,
  obs_dobra TEXT,
  peso_unit_real NUMERIC(12,3),
  peso_real NUMERIC(14,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plti_lista ON public.producao_lista_tecnica_itens(lista_id);
CREATE INDEX idx_plti_codigo ON public.producao_lista_tecnica_itens(codigo_sap);
CREATE INDEX idx_plti_elemento ON public.producao_lista_tecnica_itens(elemento);

ALTER TABLE public.producao_lista_tecnica_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY plti_select ON public.producao_lista_tecnica_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY plti_insert ON public.producao_lista_tecnica_itens FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY plti_update ON public.producao_lista_tecnica_itens FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY plti_delete ON public.producao_lista_tecnica_itens FOR DELETE TO authenticated USING (is_editor(auth.uid()));
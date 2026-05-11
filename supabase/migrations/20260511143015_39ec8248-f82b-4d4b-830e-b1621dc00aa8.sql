
CREATE TYPE public.purchase_req_status AS ENUM ('PENDENTE','APROVADA','INDEFERIDA');
CREATE TYPE public.purchase_req_class AS ENUM ('MATERIAL','SERVICO');

CREATE TABLE public.purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  data_requisicao DATE NOT NULL DEFAULT CURRENT_DATE,
  classificacao public.purchase_req_class NOT NULL DEFAULT 'MATERIAL',
  solicitante TEXT NOT NULL,
  setor TEXT,
  fornecedor TEXT,
  obra_construcao TEXT,
  obra_manutencao TEXT,
  codigo_formulario TEXT DEFAULT 'FOR-COMP: 03',
  revisao TEXT DEFAULT '01',
  data_revisao DATE,
  pagina TEXT DEFAULT '01/01',
  status public.purchase_req_status NOT NULL DEFAULT 'PENDENTE',
  motivo_indeferimento TEXT,
  observacoes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  item_numero INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  quantidade NUMERIC,
  unidade TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_items_req ON public.purchase_requisition_items(requisition_id);
CREATE INDEX idx_pr_status ON public.purchase_requisitions(status);
CREATE INDEX idx_pr_data ON public.purchase_requisitions(data_requisicao);

ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisition_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_select ON public.purchase_requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY pr_insert ON public.purchase_requisitions FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY pr_update ON public.purchase_requisitions FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY pr_delete ON public.purchase_requisitions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY pri_select ON public.purchase_requisition_items FOR SELECT TO authenticated USING (true);
CREATE POLICY pri_insert ON public.purchase_requisition_items FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY pri_update ON public.purchase_requisition_items FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY pri_delete ON public.purchase_requisition_items FOR DELETE TO authenticated USING (is_editor(auth.uid()));

CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON public.purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

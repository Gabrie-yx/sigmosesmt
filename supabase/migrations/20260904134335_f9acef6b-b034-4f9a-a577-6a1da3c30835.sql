CREATE TABLE public.epi_autorizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  epi_descricao text NOT NULL,
  estoque_epi_id uuid REFERENCES public.estoque_epi(id) ON DELETE SET NULL,
  tamanho text,
  quantidade integer NOT NULL DEFAULT 1,
  motivo text NOT NULL,
  previsao_devolucao date,
  gera_termo boolean NOT NULL DEFAULT false,
  observacoes text,
  autorizado_por uuid,
  autorizado_por_nome text,
  status text NOT NULL DEFAULT 'PENDENTE',
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '2 days'),
  entregue_por uuid,
  entregue_por_nome text,
  entregue_em timestamptz,
  entrega_excecao boolean NOT NULL DEFAULT false,
  epi_delivery_id uuid REFERENCES public.epi_deliveries(id) ON DELETE SET NULL,
  cancelado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_autorizacoes TO authenticated;
GRANT ALL ON public.epi_autorizacoes TO service_role;

ALTER TABLE public.epi_autorizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "epi_aut_select" ON public.epi_autorizacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "epi_aut_insert" ON public.epi_autorizacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "epi_aut_update" ON public.epi_autorizacoes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "epi_aut_delete" ON public.epi_autorizacoes FOR DELETE TO authenticated USING (autorizado_por = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderador'));

CREATE INDEX idx_epi_aut_status ON public.epi_autorizacoes(status, expira_em);
CREATE INDEX idx_epi_aut_employee ON public.epi_autorizacoes(employee_id);

CREATE TRIGGER trg_epi_aut_updated_at BEFORE UPDATE ON public.epi_autorizacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
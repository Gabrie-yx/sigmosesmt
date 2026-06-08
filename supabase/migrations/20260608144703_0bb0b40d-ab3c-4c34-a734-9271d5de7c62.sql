
CREATE TABLE IF NOT EXISTS public.company_frentes_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  casco_id UUID REFERENCES public.cascos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL, -- ex: "Estrutura - Casco A"
  escopo TEXT, -- descrição do serviço (corte, solda, pintura, etc)
  ghe_ids UUID[] DEFAULT ARRAY[]::UUID[], -- referências a pgr_ghe
  cargos TEXT[] DEFAULT ARRAY[]::TEXT[], -- nomes dos cargos: Soldador, Caldeireiro, etc
  qtd_prevista INT,
  data_inicio DATE,
  data_fim_prevista DATE,
  status TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','PAUSADA','ENCERRADA')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_frentes_company ON public.company_frentes_servico(company_id);
CREATE INDEX IF NOT EXISTS idx_frentes_casco ON public.company_frentes_servico(casco_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_frentes_servico TO authenticated;
GRANT ALL ON public.company_frentes_servico TO service_role;

ALTER TABLE public.company_frentes_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frentes_select" ON public.company_frentes_servico
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "frentes_insert" ON public.company_frentes_servico
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "frentes_update" ON public.company_frentes_servico
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "frentes_delete" ON public.company_frentes_servico
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER frentes_updated_at
  BEFORE UPDATE ON public.company_frentes_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

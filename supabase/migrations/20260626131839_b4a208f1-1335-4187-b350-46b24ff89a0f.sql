
CREATE TABLE public.producao_fatores_consumo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_embarcacao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('FERRO','SOLDA','GÁS','TINTA','OUTROS')),
  unidade TEXT NOT NULL DEFAULT 'KG',
  fator_por_ton_aco NUMERIC NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'AUTO' CHECK (fonte IN ('AUTO','MANUAL')),
  cascos_base INT NOT NULL DEFAULT 0,
  cascos_ids JSONB DEFAULT '[]'::jsonb,
  observacao TEXT,
  recalculado_em TIMESTAMPTZ DEFAULT now(),
  travado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE (tipo_embarcacao, categoria, unidade)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producao_fatores_consumo TO authenticated;
GRANT ALL ON public.producao_fatores_consumo TO service_role;

ALTER TABLE public.producao_fatores_consumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewer le" ON public.producao_fatores_consumo FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "editor insert" ON public.producao_fatores_consumo FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "editor update" ON public.producao_fatores_consumo FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "moderator delete" ON public.producao_fatores_consumo FOR DELETE TO authenticated USING (public.is_moderator(auth.uid()));

CREATE TRIGGER trg_fatores_consumo_updated_at
BEFORE UPDATE ON public.producao_fatores_consumo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

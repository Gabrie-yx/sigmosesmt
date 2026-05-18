
-- 1) Base de Matéria-Prima (fonte da verdade para classificação)
CREATE TABLE public.producao_base_materia_prima (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('FERRO','GÁS','SOLDA','TINTA','OUTROS')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_base_mp_tipo ON public.producao_base_materia_prima(tipo);
ALTER TABLE public.producao_base_materia_prima ENABLE ROW LEVEL SECURITY;
CREATE POLICY base_mp_select ON public.producao_base_materia_prima FOR SELECT TO authenticated USING (true);
CREATE POLICY base_mp_insert ON public.producao_base_materia_prima FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY base_mp_update ON public.producao_base_materia_prima FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY base_mp_delete ON public.producao_base_materia_prima FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- 2) Ordens SAP importadas via MB51
CREATE TABLE public.producao_mb51_ordens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_sap TEXT NOT NULL UNIQUE,
  texto_documento TEXT,
  casco_id UUID REFERENCES public.cascos(id) ON DELETE SET NULL,
  arquivo_nome TEXT,
  qtd_movimentos INTEGER NOT NULL DEFAULT 0,
  qtd_consumo_liquido NUMERIC NOT NULL DEFAULT 0,
  data_primeiro_movimento DATE,
  data_ultimo_movimento DATE,
  importado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mb51_ord_casco ON public.producao_mb51_ordens(casco_id);
ALTER TABLE public.producao_mb51_ordens ENABLE ROW LEVEL SECURITY;
CREATE POLICY mb51_ord_select ON public.producao_mb51_ordens FOR SELECT TO authenticated USING (true);
CREATE POLICY mb51_ord_insert ON public.producao_mb51_ordens FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY mb51_ord_update ON public.producao_mb51_ordens FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY mb51_ord_delete ON public.producao_mb51_ordens FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- 3) Movimentos da MB51 (linha a linha)
CREATE TABLE public.producao_mb51_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id UUID NOT NULL REFERENCES public.producao_mb51_ordens(id) ON DELETE CASCADE,
  numero_sap TEXT NOT NULL,
  material TEXT NOT NULL,
  descricao TEXT,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  unidade TEXT,
  data_lancamento DATE,
  tipo_movimento TEXT,
  classificacao_mb51 TEXT,
  tipo_resolvido TEXT NOT NULL DEFAULT 'OUTROS' CHECK (tipo_resolvido IN ('FERRO','GÁS','SOLDA','TINTA','OUTROS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mb51_mov_ordem ON public.producao_mb51_movimentos(ordem_id);
CREATE INDEX idx_mb51_mov_material ON public.producao_mb51_movimentos(material);
CREATE INDEX idx_mb51_mov_tipo ON public.producao_mb51_movimentos(tipo_resolvido);
ALTER TABLE public.producao_mb51_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY mb51_mov_select ON public.producao_mb51_movimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY mb51_mov_insert ON public.producao_mb51_movimentos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY mb51_mov_update ON public.producao_mb51_movimentos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY mb51_mov_delete ON public.producao_mb51_movimentos FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Triggers updated_at
CREATE TRIGGER trg_base_mp_updated BEFORE UPDATE ON public.producao_base_materia_prima
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mb51_ord_updated BEFORE UPDATE ON public.producao_mb51_ordens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

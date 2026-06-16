-- =====================================================================
-- FM-SGI-05 — Catálogo de gases atmosféricos
-- =====================================================================
CREATE TABLE public.catalogo_gases_atmosfericos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  simbolo TEXT NOT NULL,
  unidade TEXT NOT NULL CHECK (unidade IN ('%','ppm','mg/m3')),
  limite_min NUMERIC,
  limite_max NUMERIC,
  descricao_limite TEXT,
  ordem INT NOT NULL DEFAULT 999,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_padrao_nr33 BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (simbolo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_gases_atmosfericos TO authenticated;
GRANT ALL ON public.catalogo_gases_atmosfericos TO service_role;

ALTER TABLE public.catalogo_gases_atmosfericos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_gases_select_authenticated"
  ON public.catalogo_gases_atmosfericos FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalogo_gases_insert_moderator"
  ON public.catalogo_gases_atmosfericos FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator(auth.uid()));

CREATE POLICY "catalogo_gases_update_moderator"
  ON public.catalogo_gases_atmosfericos FOR UPDATE TO authenticated
  USING (public.is_moderator(auth.uid())) WITH CHECK (public.is_moderator(auth.uid()));

CREATE POLICY "catalogo_gases_delete_admin"
  ON public.catalogo_gases_atmosfericos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_catalogo_gases_updated_at
  BEFORE UPDATE ON public.catalogo_gases_atmosfericos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: 4 gases padrão NR-33
INSERT INTO public.catalogo_gases_atmosfericos
  (nome, simbolo, unidade, limite_min, limite_max, descricao_limite, ordem, is_padrao_nr33) VALUES
  ('Oxigênio', 'O2', '%', 19.5, 23.0, 'Entre 19,5% e 23% (NR-33 item 33.3.5.3)', 1, true),
  ('Limite Inferior de Explosividade', 'LIE', '%', NULL, 10.0, 'Inferior a 10% do LIE (NR-33 item 33.3.5.3)', 2, true),
  ('Sulfeto de Hidrogênio', 'H2S', 'ppm', NULL, 8.0, 'Inferior a 8 ppm (NR-15 Anexo 11)', 3, true),
  ('Monóxido de Carbono', 'CO', 'ppm', NULL, 25.0, 'Inferior a 25 ppm (NR-15 Anexo 11)', 4, true);

-- =====================================================================
-- FM-SGI-05 — Medições atmosféricas do PET (1 PET → N medições)
-- =====================================================================
CREATE TABLE public.pte_medicoes_atmosfericas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pte_id UUID NOT NULL REFERENCES public.ptes(id) ON DELETE CASCADE,
  momento TEXT NOT NULL DEFAULT 'ENTRADA' CHECK (momento IN ('ENTRADA','PERIODICA','SAIDA')),
  medido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  equipamento_marca TEXT,
  equipamento_modelo TEXT,
  equipamento_serie TEXT,
  calibracao_data DATE,
  calibracao_validade DATE,
  executor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  executor_nome TEXT,
  -- leituras: array de objetos { gas_id, simbolo, valor, unidade, limite_min, limite_max, fora_limite }
  leituras JSONB NOT NULL DEFAULT '[]'::jsonb,
  tem_fora_limite BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_pte_medicoes_pte_id ON public.pte_medicoes_atmosfericas(pte_id);
CREATE INDEX idx_pte_medicoes_medido_em ON public.pte_medicoes_atmosfericas(medido_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pte_medicoes_atmosfericas TO authenticated;
GRANT ALL ON public.pte_medicoes_atmosfericas TO service_role;

ALTER TABLE public.pte_medicoes_atmosfericas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pte_medicoes_select_authenticated"
  ON public.pte_medicoes_atmosfericas FOR SELECT TO authenticated USING (true);

CREATE POLICY "pte_medicoes_insert_editor"
  ON public.pte_medicoes_atmosfericas FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "pte_medicoes_update_editor"
  ON public.pte_medicoes_atmosfericas FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "pte_medicoes_delete_moderator"
  ON public.pte_medicoes_atmosfericas FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

CREATE TRIGGER trg_pte_medicoes_updated_at
  BEFORE UPDATE ON public.pte_medicoes_atmosfericas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalcula tem_fora_limite a partir das leituras (qualquer leitura.fora_limite=true)
CREATE OR REPLACE FUNCTION public.pte_medicoes_calc_fora_limite()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.tem_fora_limite := EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.leituras,'[]'::jsonb)) AS l
    WHERE COALESCE((l->>'fora_limite')::boolean, false) = true
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pte_medicoes_calc_fora_limite
  BEFORE INSERT OR UPDATE ON public.pte_medicoes_atmosfericas
  FOR EACH ROW EXECUTE FUNCTION public.pte_medicoes_calc_fora_limite();

-- Auditoria (usa função genérica já existente no projeto)
CREATE TRIGGER trg_audit_pte_medicoes
  AFTER INSERT OR UPDATE OR DELETE ON public.pte_medicoes_atmosfericas
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER trg_audit_catalogo_gases
  AFTER INSERT OR UPDATE OR DELETE ON public.catalogo_gases_atmosfericos
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
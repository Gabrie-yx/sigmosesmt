
-- 1) Extend cal_status enum
ALTER TYPE public.cal_status ADD VALUE IF NOT EXISTS 'revogado';

-- 2) New columns in cal_requisitos for full Ius Natura fidelity + delta tracking
ALTER TABLE public.cal_requisitos
  ADD COLUMN IF NOT EXISTS codigo_requisito_generico text,
  ADD COLUMN IF NOT EXISTS temas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tipo_evidencia text,
  ADD COLUMN IF NOT EXISTS evidencia_texto text,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS status_vcl text,
  ADD COLUMN IF NOT EXISTS data_vcl date,
  ADD COLUMN IF NOT EXISTS data_ultima_alteracao_ius date,
  ADD COLUMN IF NOT EXISTS data_inclusao_cal date,
  ADD COLUMN IF NOT EXISTS area_incidencia text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS precisa_revalidacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_importacao_id uuid REFERENCES public.cal_lote_importacao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cal_requisitos_hash ON public.cal_requisitos(content_hash);
CREATE INDEX IF NOT EXISTS idx_cal_requisitos_revalidacao ON public.cal_requisitos(precisa_revalidacao) WHERE precisa_revalidacao;

-- 3) Delta counters on lote de importação
ALTER TABLE public.cal_lote_importacao
  ADD COLUMN IF NOT EXISTS total_novos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_atualizados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revogados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_inalterados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delta_resumo jsonb;

-- 4) Normas vinculadas (N leis por 1 requisito)
CREATE TABLE IF NOT EXISTS public.cal_normas_vinculadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_id uuid NOT NULL REFERENCES public.cal_requisitos(id) ON DELETE CASCADE,
  codigo_norma text NOT NULL,
  descricao_norma text,
  data_inclusao date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisito_id, codigo_norma)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_normas_vinculadas TO authenticated;
GRANT ALL ON public.cal_normas_vinculadas TO service_role;
ALTER TABLE public.cal_normas_vinculadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read cal_normas" ON public.cal_normas_vinculadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write cal_normas" ON public.cal_normas_vinculadas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cal_normas" ON public.cal_normas_vinculadas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete cal_normas" ON public.cal_normas_vinculadas FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_cal_normas_req ON public.cal_normas_vinculadas(requisito_id);

-- 5) Planos de ação vindos do Ius Natura, vinculados ao requisito
CREATE TABLE IF NOT EXISTS public.cal_planos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_id uuid NOT NULL REFERENCES public.cal_requisitos(id) ON DELETE CASCADE,
  codigo_pa text,
  texto text NOT NULL,
  tipo text,
  status text,
  data_prevista date,
  data_conclusao date,
  recorrente boolean NOT NULL DEFAULT false,
  intervalo_recorrencia_dias integer,
  custo numeric,
  natureza_custo text,
  usuario_execucao text,
  usuario_gestao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisito_id, codigo_pa)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_planos_acao TO authenticated;
GRANT ALL ON public.cal_planos_acao TO service_role;
ALTER TABLE public.cal_planos_acao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read cal_pa" ON public.cal_planos_acao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write cal_pa" ON public.cal_planos_acao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cal_pa" ON public.cal_planos_acao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete cal_pa" ON public.cal_planos_acao FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_cal_pa_req ON public.cal_planos_acao(requisito_id);
CREATE TRIGGER trg_cal_pa_updated BEFORE UPDATE ON public.cal_planos_acao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

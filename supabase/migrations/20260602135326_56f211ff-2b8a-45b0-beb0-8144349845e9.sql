-- FASE 2 — Integração PGR ↔ Colaboradores ↔ EPIs

-- 1) Adiciona ghe_id em employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_ghe_id ON public.employees(ghe_id);

-- 2) Tabela de vínculo Risco ↔ EPI
CREATE TABLE IF NOT EXISTS public.pgr_risco_epi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id UUID NOT NULL REFERENCES public.pgr_inventario_riscos(id) ON DELETE CASCADE,
  epi_id        UUID NOT NULL REFERENCES public.estoque_epi(id) ON DELETE CASCADE,
  obrigatorio   BOOLEAN NOT NULL DEFAULT true,
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inventario_id, epi_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_risco_epi TO authenticated;
GRANT ALL ON public.pgr_risco_epi TO service_role;

ALTER TABLE public.pgr_risco_epi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pgr_risco_epi_select_auth" ON public.pgr_risco_epi
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "pgr_risco_epi_insert_editor" ON public.pgr_risco_epi
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "pgr_risco_epi_update_editor" ON public.pgr_risco_epi
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "pgr_risco_epi_delete_editor" ON public.pgr_risco_epi
  FOR DELETE TO authenticated USING (public.is_editor(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pgr_risco_epi_inv ON public.pgr_risco_epi(inventario_id);
CREATE INDEX IF NOT EXISTS idx_pgr_risco_epi_epi ON public.pgr_risco_epi(epi_id);

CREATE TRIGGER trg_pgr_risco_epi_updated_at
BEFORE UPDATE ON public.pgr_risco_epi
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) View consolidada Colaborador → GHE → Riscos → EPIs
CREATE OR REPLACE VIEW public.vw_colaborador_pgr
WITH (security_invoker = true)
AS
SELECT
  e.id              AS employee_id,
  e.nome            AS employee_nome,
  e.tipo_cadastro   AS employee_tipo_cadastro,
  e.role_id,
  g.id              AS ghe_id,
  g.numero          AS ghe_numero,
  g.setor           AS ghe_setor,
  g.descricao_ambiente,
  r.id              AS risco_id,
  r.categoria,
  r.perigo,
  r.agravo,
  r.fonte_geradora,
  r.controles_existentes,
  r.exposicao,
  r.probabilidade,
  r.severidade,
  r.risco           AS risco_score,
  r.classificacao,
  r.intensidade,
  r.unidade,
  r.limite_tolerancia,
  r.monitoramento,
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'epi_id',      ep.id,
        'nome',        ep.nome_material,
        'codigo',      ep.codigo_material,
        'ca',          ep.ca,
        'ca_validade', ep.ca_validade,
        'imagem_url',  ep.imagem_url,
        'obrigatorio', re.obrigatorio,
        'observacao',  re.observacao
      ) ORDER BY ep.nome_material)
      FROM public.pgr_risco_epi re
      JOIN public.estoque_epi ep ON ep.id = re.epi_id
      WHERE re.inventario_id = r.id
    ),
    '[]'::jsonb
  ) AS epis
FROM public.employees e
JOIN public.pgr_ghe g                    ON g.id = e.ghe_id AND g.ativo = true
LEFT JOIN public.pgr_inventario_riscos r ON r.ghe_id = g.id AND r.ativo = true;

GRANT SELECT ON public.vw_colaborador_pgr TO authenticated;
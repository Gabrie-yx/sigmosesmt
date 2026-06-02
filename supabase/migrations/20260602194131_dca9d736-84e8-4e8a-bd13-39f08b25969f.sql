
-- 1) Tabela de overrides (exceções manuais cargo→GHE)
CREATE TABLE public.pgr_ghe_membros_override (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ghe_id UUID NOT NULL REFERENCES public.pgr_ghe(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (acao IN ('INCLUIR','EXCLUIR')),
  motivo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, ghe_id, acao)
);

CREATE INDEX idx_pgr_ghe_override_emp ON public.pgr_ghe_membros_override(employee_id);
CREATE INDEX idx_pgr_ghe_override_ghe ON public.pgr_ghe_membros_override(ghe_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_ghe_membros_override TO authenticated;
GRANT ALL ON public.pgr_ghe_membros_override TO service_role;

ALTER TABLE public.pgr_ghe_membros_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewer_or_above_select_override"
  ON public.pgr_ghe_membros_override FOR SELECT
  TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editor_insert_override"
  ON public.pgr_ghe_membros_override FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "editor_update_override"
  ON public.pgr_ghe_membros_override FOR UPDATE
  TO authenticated
  USING (public.is_editor(auth.uid()));

CREATE POLICY "moderator_delete_override"
  ON public.pgr_ghe_membros_override FOR DELETE
  TO authenticated
  USING (public.is_moderator(auth.uid()));

CREATE TRIGGER tg_pgr_ghe_override_updated_at
  BEFORE UPDATE ON public.pgr_ghe_membros_override
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) VIEW: membros efetivos por GHE
-- Combina: funcionários cujo cargo tem ghe_id setado + overrides INCLUIR, removendo overrides EXCLUIR
CREATE OR REPLACE VIEW public.pgr_ghe_membros_efetivos AS
WITH base AS (
  SELECT e.id AS employee_id, r.ghe_id, 'CARGO'::text AS origem
  FROM public.employees e
  JOIN public.roles r ON r.id = e.role_id
  WHERE r.ghe_id IS NOT NULL
    AND COALESCE(e.status,'ATIVO') = 'ATIVO'
  UNION
  SELECT o.employee_id, o.ghe_id, 'OVERRIDE'::text AS origem
  FROM public.pgr_ghe_membros_override o
  JOIN public.employees e ON e.id = o.employee_id
  WHERE o.acao = 'INCLUIR'
    AND COALESCE(e.status,'ATIVO') = 'ATIVO'
)
SELECT b.employee_id, b.ghe_id, MIN(b.origem) AS origem
FROM base b
WHERE NOT EXISTS (
  SELECT 1 FROM public.pgr_ghe_membros_override x
  WHERE x.employee_id = b.employee_id
    AND x.ghe_id = b.ghe_id
    AND x.acao = 'EXCLUIR'
)
GROUP BY b.employee_id, b.ghe_id;

GRANT SELECT ON public.pgr_ghe_membros_efetivos TO authenticated;
GRANT SELECT ON public.pgr_ghe_membros_efetivos TO service_role;

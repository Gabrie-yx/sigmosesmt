-- 1) risco_exames
CREATE TABLE public.risco_exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  risco_id UUID NOT NULL REFERENCES public.catalogo_riscos(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exam_catalog(id) ON DELETE CASCADE,
  naturezas TEXT[] NOT NULL DEFAULT ARRAY['ADMISSIONAL','PERIODICO','MUDANCA_FUNCAO','RETORNO_TRABALHO','DEMISSIONAL']::TEXT[],
  periodicidade_meses INTEGER,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  base_legal TEXT,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (risco_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risco_exames TO authenticated;
GRANT ALL ON public.risco_exames TO service_role;
ALTER TABLE public.risco_exames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risco_exames read auth" ON public.risco_exames
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "risco_exames write editor" ON public.risco_exames
  FOR ALL TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));
CREATE TRIGGER trg_risco_exames_updated
  BEFORE UPDATE ON public.risco_exames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_risco_exames_risco ON public.risco_exames(risco_id) WHERE ativo;
CREATE INDEX idx_risco_exames_exam ON public.risco_exames(exam_id) WHERE ativo;

-- 2) exam_natureza_base
CREATE TABLE public.exam_natureza_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  natureza TEXT NOT NULL,
  exam_id UUID NOT NULL REFERENCES public.exam_catalog(id) ON DELETE CASCADE,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (natureza, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_natureza_base TO authenticated;
GRANT ALL ON public.exam_natureza_base TO service_role;
ALTER TABLE public.exam_natureza_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_natureza_base read auth" ON public.exam_natureza_base
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_natureza_base write editor" ON public.exam_natureza_base
  FOR ALL TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));
CREATE TRIGGER trg_exam_natureza_base_updated
  BEFORE UPDATE ON public.exam_natureza_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) resolver_exames_funcionario
CREATE OR REPLACE FUNCTION public.resolver_exames_funcionario(
  _employee_id UUID,
  _natureza TEXT
)
RETURNS TABLE (
  exam_id UUID,
  codigo TEXT,
  procedimento TEXT,
  obrigatorio BOOLEAN,
  origem TEXT,
  motivo TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH cargo_func AS (
    SELECT role_id FROM public.employees WHERE id = _employee_id
  ),
  riscos_cargo AS (
    SELECT DISTINCT cr.risco_id, c.nome AS risco_nome
    FROM public.cargo_riscos cr
    JOIN public.catalogo_riscos c ON c.id = cr.risco_id
    WHERE cr.role_id = (SELECT role_id FROM cargo_func)
      AND cr.ativo = true
  ),
  por_risco AS (
    SELECT
      re.exam_id, re.obrigatorio,
      'RISCO'::TEXT AS origem,
      string_agg(DISTINCT rc.risco_nome, ', ') AS motivo
    FROM public.risco_exames re
    JOIN riscos_cargo rc ON rc.risco_id = re.risco_id
    WHERE re.ativo = true AND _natureza = ANY(re.naturezas)
    GROUP BY re.exam_id, re.obrigatorio
  ),
  base AS (
    SELECT enb.exam_id, enb.obrigatorio, 'BASE'::TEXT AS origem, 'Base ' || _natureza AS motivo
    FROM public.exam_natureza_base enb
    WHERE enb.ativo = true AND enb.natureza = _natureza
  ),
  unificado AS (SELECT * FROM base UNION ALL SELECT * FROM por_risco)
  SELECT
    u.exam_id, ec.codigo, ec.procedimento,
    bool_or(u.obrigatorio) AS obrigatorio,
    string_agg(DISTINCT u.origem, '+') AS origem,
    string_agg(DISTINCT u.motivo, ' | ') AS motivo
  FROM unificado u
  JOIN public.exam_catalog ec ON ec.id = u.exam_id
  WHERE ec.ativo = true
  GROUP BY u.exam_id, ec.codigo, ec.procedimento
  ORDER BY bool_or(u.obrigatorio) DESC, ec.procedimento;
$$;
GRANT EXECUTE ON FUNCTION public.resolver_exames_funcionario(UUID, TEXT) TO authenticated, service_role;

-- 4) SEED base por natureza (Clínico Ocupacional)
INSERT INTO public.exam_natureza_base (natureza, exam_id, obrigatorio, observacao) VALUES
  ('ADMISSIONAL',      'd0f82b0b-85b1-4955-88c5-e4e6e05ff776', true, 'NR-7 7.5.6.1 a)'),
  ('PERIODICO',        'd0f82b0b-85b1-4955-88c5-e4e6e05ff776', true, 'NR-7 7.5.6.1 b)'),
  ('MUDANCA_FUNCAO',   'd0f82b0b-85b1-4955-88c5-e4e6e05ff776', true, 'NR-7 7.5.6.1 c)'),
  ('RETORNO_TRABALHO', 'd0f82b0b-85b1-4955-88c5-e4e6e05ff776', true, 'NR-7 7.5.6.1 d)'),
  ('DEMISSIONAL',      'd0f82b0b-85b1-4955-88c5-e4e6e05ff776', true, 'NR-7 7.5.6.1 e)')
ON CONFLICT DO NOTHING;

-- 5) SEED risco_exames
INSERT INTO public.risco_exames (risco_id, exam_id, naturezas, periodicidade_meses, base_legal) VALUES
  ('734d6ec2-3f99-4f32-8f4c-51894c04b45f','bf4d7d00-305e-4f33-8e4f-84bbc7cd6f83', ARRAY['ADMISSIONAL','PERIODICO','MUDANCA_FUNCAO','DEMISSIONAL'], 12, 'NR-7 Anexo I (PCA) — Ruído'),
  ('a3377fa3-e979-4403-b555-5318aaa6b13c','b9babe1f-8764-4404-8ba5-76c62b9dbbf0', ARRAY['ADMISSIONAL','PERIODICO','DEMISSIONAL'], 6,  'NR-7 Quadro I — Radiação ionizante'),
  ('f790afea-f201-4c09-bddf-0768ef0c6738','932d0d6a-d3b7-4fda-8ce3-cb8fa69539d8', ARRAY['ADMISSIONAL','PERIODICO','DEMISSIONAL'], 12, 'NR-15 Anexo 12 — Asbesto'),
  ('f790afea-f201-4c09-bddf-0768ef0c6738','713ed946-2d1c-4111-bb8a-49400cd620d4', ARRAY['ADMISSIONAL','PERIODICO','DEMISSIONAL'], 12, 'NR-15 Anexo 12 — Asbesto'),
  ('cc519023-62aa-445d-bc53-412b6b890aad','b9babe1f-8764-4404-8ba5-76c62b9dbbf0', ARRAY['ADMISSIONAL','PERIODICO','MUDANCA_FUNCAO','DEMISSIONAL'], 3, 'NR-7 Anexo II — Benzeno'),
  ('a1c23be3-b538-4677-833a-8a7d210de6b0','b79ca940-7cd9-4a7f-b4a7-bdbc68493b65', ARRAY['ADMISSIONAL','PERIODICO','MUDANCA_FUNCAO'], 12, 'NR-35 — Trabalho em altura'),
  ('a1c23be3-b538-4677-833a-8a7d210de6b0','764886f3-9fab-4c01-bef2-748d56615fd9', ARRAY['ADMISSIONAL','PERIODICO'], 12, 'NR-35 — Glicemia'),
  ('a1c23be3-b538-4677-833a-8a7d210de6b0','9e0fc09d-cded-473f-bcdc-e0fe914be046', ARRAY['ADMISSIONAL','PERIODICO'], 24, 'NR-35 — Avaliação neurológica'),
  ('8f094192-5fab-4904-96b4-b74f7cb98335','fff3d5ef-d1e1-435a-a1b3-73aa8b8a90c9', ARRAY['ADMISSIONAL','PERIODICO','MUDANCA_FUNCAO'], 12, 'NR-33 — Espaço confinado'),
  ('8f094192-5fab-4904-96b4-b74f7cb98335','713ed946-2d1c-4111-bb8a-49400cd620d4', ARRAY['ADMISSIONAL','PERIODICO'], 12, 'NR-33 — Função pulmonar'),
  ('9c1b41ee-3426-4724-aa95-add8c0f8d424','fff3d5ef-d1e1-435a-a1b3-73aa8b8a90c9', ARRAY['ADMISSIONAL','PERIODICO'], 12, 'NR-10 — Eletricidade'),
  ('9c1b41ee-3426-4724-aa95-add8c0f8d424','9e0fc09d-cded-473f-bcdc-e0fe914be046', ARRAY['ADMISSIONAL','PERIODICO'], 24, 'NR-10 SEP'),
  ('d49a1f2b-20ca-4d4b-a3b5-0cc55d91082c','fff3d5ef-d1e1-435a-a1b3-73aa8b8a90c9', ARRAY['ADMISSIONAL','PERIODICO','DEMISSIONAL'], 6, 'NR-15 Anexo 6 — Hiperbárica'),
  ('1aeaa108-99c5-4684-a779-1ce0762f578f','fff3d5ef-d1e1-435a-a1b3-73aa8b8a90c9', ARRAY['ADMISSIONAL','PERIODICO'], 12, 'NR-15 Anexo 3 — Calor (IBUTG)'),
  ('5cf640ba-abba-4d25-9f01-c0e966583562','fff3d5ef-d1e1-435a-a1b3-73aa8b8a90c9', ARRAY['ADMISSIONAL','PERIODICO'], 12, 'NR-15 Anexo 3 — Calor'),
  ('90ab63da-272b-4c5f-8e40-75abf5e3c9d2','b9babe1f-8764-4404-8ba5-76c62b9dbbf0', ARRAY['ADMISSIONAL','PERIODICO','DEMISSIONAL'], 12, 'NR-32 — Microorganismos (saúde)')
ON CONFLICT (risco_id, exam_id) DO NOTHING;
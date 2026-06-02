-- 1) Adicionar suporte a terceirizados em employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS tipo_vinculo text NOT NULL DEFAULT 'PROPRIO'
    CHECK (tipo_vinculo IN ('PROPRIO','TERCEIRO')),
  ADD COLUMN IF NOT EXISTS empresa_terceira_id uuid;

-- 2) Criar tabela de empresas terceirizadas
CREATE TABLE IF NOT EXISTS public.empresas_terceiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text UNIQUE,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  contrato_numero text,
  contrato_inicio date,
  contrato_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas_terceiras TO authenticated;
GRANT ALL ON public.empresas_terceiras TO service_role;

ALTER TABLE public.empresas_terceiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers_select_empresas_terceiras"
  ON public.empresas_terceiras FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editors_insert_empresas_terceiras"
  ON public.empresas_terceiras FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "editors_update_empresas_terceiras"
  ON public.empresas_terceiras FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()));

CREATE POLICY "admins_delete_empresas_terceiras"
  ON public.empresas_terceiras FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_empresas_terceiras_updated
  BEFORE UPDATE ON public.empresas_terceiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK depois da tabela criada
ALTER TABLE public.employees
  ADD CONSTRAINT employees_empresa_terceira_fk
  FOREIGN KEY (empresa_terceira_id) REFERENCES public.empresas_terceiras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_tipo_vinculo ON public.employees(tipo_vinculo);
CREATE INDEX IF NOT EXISTS idx_employees_empresa_terceira ON public.employees(empresa_terceira_id);

-- 3) Pacote Naval — matriz de exames pronta (inclui Fit Test 12 meses para Pintor/Jatista)
-- Pintor Industrial
UPDATE public.roles SET
  req_exames = ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)','Monitoramento Biológico (Solventes)'],
  exames_por_natureza = jsonb_build_object(
    'ADMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)','Monitoramento Biológico (Solventes)']),
    'PERIODICO',  to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)','Monitoramento Biológico (Solventes)']),
    'DEMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT']),
    'MUDANCA_RISCO', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Fit Test (Vedação Respirador)']),
    'RETORNO_TRABALHO', to_jsonb(ARRAY['ASO Clínico']),
    'SEMESTRAL', to_jsonb(ARRAY['Monitoramento Biológico (Solventes)'])
  ),
  updated_at = now()
WHERE name = 'Pintor Industrial';

-- Pintor/Jatista (já existe — adicionar Fit Test e Monitoramento Biológico)
UPDATE public.roles SET
  req_exames = ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)','Monitoramento Biológico (Solventes)'],
  exames_por_natureza = jsonb_build_object(
    'ADMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)','Monitoramento Biológico (Solventes)']),
    'PERIODICO',  to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)','Monitoramento Biológico (Solventes)']),
    'DEMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT']),
    'MUDANCA_RISCO', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Fit Test (Vedação Respirador)']),
    'RETORNO_TRABALHO', to_jsonb(ARRAY['ASO Clínico']),
    'SEMESTRAL', to_jsonb(ARRAY['Monitoramento Biológico (Solventes)'])
  ),
  updated_at = now()
WHERE name = 'Pintura e Tratamento (Pintor/Jatista)';

-- Soldador (já tem base — adicionar Fit Test pra fumos metálicos)
UPDATE public.roles SET
  req_exames = ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)'],
  exames_por_natureza = jsonb_build_object(
    'ADMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)']),
    'PERIODICO',  to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual','Fit Test (Vedação Respirador)']),
    'DEMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT']),
    'MUDANCA_RISCO', to_jsonb(ARRAY['ASO Clínico','Espirometria','Raio-X de Tórax OIT','Fit Test (Vedação Respirador)']),
    'RETORNO_TRABALHO', to_jsonb(ARRAY['ASO Clínico']),
    'SEMESTRAL', to_jsonb(ARRAY[]::text[])
  ),
  updated_at = now()
WHERE name IN ('Soldador','Operacional Metalurgia (Soldador/Maçariqueiro)');

-- Mecânico Naval — criar se não existir
INSERT INTO public.roles (name, req_aso, req_integra, req_nrs, req_exames, exames_por_natureza, ativo, setor)
SELECT
  'Mecânico Naval', true, true,
  ARRAY['NR-01','NR-06','NR-10','NR-11','NR-12','NR-13','NR-33','NR-34','NR-35'],
  ARRAY['ASO Clínico','Audiometria','Acuidade Visual','Eletrocardiograma','Glicemia'],
  jsonb_build_object(
    'ADMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria','Acuidade Visual','Eletrocardiograma','Glicemia']),
    'PERIODICO',  to_jsonb(ARRAY['ASO Clínico','Audiometria','Acuidade Visual','Eletrocardiograma','Glicemia']),
    'DEMISSIONAL', to_jsonb(ARRAY['ASO Clínico','Audiometria']),
    'MUDANCA_RISCO', to_jsonb(ARRAY['ASO Clínico','Audiometria']),
    'RETORNO_TRABALHO', to_jsonb(ARRAY['ASO Clínico']),
    'SEMESTRAL', to_jsonb(ARRAY[]::text[])
  ),
  true, 'Manutenção Naval'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Mecânico Naval');
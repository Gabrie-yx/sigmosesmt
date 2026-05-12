-- Adiciona campos PCMSO/ISO 9001 ao cargo (preservando dados existentes)
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS ghe text,
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS cbo text,
  ADD COLUMN IF NOT EXISTS exames_por_natureza jsonb NOT NULL DEFAULT
    '{"ADMISSIONAL":[],"PERIODICO":[],"RETORNO_TRABALHO":[],"MUDANCA_RISCO":[],"DEMISSIONAL":[],"SEMESTRAL":[]}'::jsonb;

-- Migra exames legados (req_exames) para o admissional+periódico, sem perder nada
UPDATE public.roles
   SET exames_por_natureza = jsonb_set(
         jsonb_set(exames_por_natureza, '{ADMISSIONAL}', to_jsonb(req_exames), true),
         '{PERIODICO}', to_jsonb(req_exames), true)
 WHERE req_exames IS NOT NULL
   AND array_length(req_exames, 1) > 0
   AND (exames_por_natureza->'ADMISSIONAL') = '[]'::jsonb;

-- Expande estrutura de riscos para incluir Acidente/Mecânico e Biológico
-- (mantém fisicos/quimicos/ergonomicos/descricao já existentes)
UPDATE public.roles
   SET riscos = COALESCE(riscos, '{}'::jsonb)
              || jsonb_build_object(
                   'acidente_mecanico', COALESCE(riscos->'acidente_mecanico', '[]'::jsonb),
                   'biologicos',         COALESCE(riscos->'biologicos',         '[]'::jsonb),
                   'psicossociais',      COALESCE(riscos->'psicossociais',      '[]'::jsonb)
                 );

-- Atualiza default da coluna riscos para refletir a nova estrutura completa
ALTER TABLE public.roles
  ALTER COLUMN riscos SET DEFAULT
  '{"acidente_mecanico":[],"fisicos":[],"quimicos":[],"biologicos":[],"ergonomicos":[],"psicossociais":[],"descricao":""}'::jsonb;

-- Catálogo de procedimentos diagnósticos (eSocial Tabela 27)
CREATE TABLE IF NOT EXISTS public.exam_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,        -- ex: "0283"
  procedimento text NOT NULL,         -- ex: "Audiometria Tonal limiar com testes de discriminação"
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_catalog_select" ON public.exam_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_catalog_insert" ON public.exam_catalog
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY "exam_catalog_update" ON public.exam_catalog
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY "exam_catalog_delete" ON public.exam_catalog
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_exam_catalog_updated
  BEFORE UPDATE ON public.exam_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed dos códigos eSocial mais comuns observados no PCMSO REV.05
INSERT INTO public.exam_catalog (codigo, procedimento) VALUES
  ('0283', 'Audiometria Tonal limiar com testes de discriminação'),
  ('0295', 'Avaliação clínica ocupacional (anamnese e exame físico)'),
  ('0658', 'Glicemia'),
  ('0673', 'Grupo sanguíneo ABO, e fator Rho (inclui Du)'),
  ('0298', 'Acuidade Visual'),
  ('0356', 'Espirometria'),
  ('0317', 'Eletrocardiograma (ECG)'),
  ('0414', 'Hemograma completo'),
  ('0853', 'Raio-X de Tórax PA/Perfil (OIT)'),
  ('0345', 'EEG (Eletroencefalograma)'),
  ('0916', 'Toxicológico (motorista profissional)'),
  ('0890', 'Urina tipo I (EAS)')
ON CONFLICT (codigo) DO NOTHING;

-- Índice para busca rápida por GHE
CREATE INDEX IF NOT EXISTS idx_roles_ghe ON public.roles (ghe) WHERE ghe IS NOT NULL;
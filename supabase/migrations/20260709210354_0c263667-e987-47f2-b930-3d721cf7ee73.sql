
-- 1) Tabela vacina_catalog
CREATE TABLE IF NOT EXISTS public.vacina_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_comercial text,
  doses_recomendadas integer NOT NULL DEFAULT 1,
  intervalo_doses text,
  via_aplicacao text,
  indicacao_ocupacional text,
  contraindicacoes text,
  origem text NOT NULL DEFAULT 'PNI',
  reforco_periodicidade text,
  codigo_esocial text,
  riscos_relacionados text[] DEFAULT ARRAY[]::text[],
  categorias_profissionais text[] DEFAULT ARRAY[]::text[],
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vacina_catalog_origem_chk CHECK (origem IN ('PNI', 'PRIVADA', 'AMBAS'))
);

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacina_catalog TO authenticated;
GRANT ALL ON public.vacina_catalog TO service_role;

-- 3) RLS
ALTER TABLE public.vacina_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_vacina_catalog"
  ON public.vacina_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_vacina_catalog"
  ON public.vacina_catalog FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_vacina_catalog"
  ON public.vacina_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_vacina_catalog"
  ON public.vacina_catalog FOR DELETE TO authenticated USING (true);

-- 4) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS vacina_catalog_updated_at_trg ON public.vacina_catalog;
CREATE TRIGGER vacina_catalog_updated_at_trg
  BEFORE UPDATE ON public.vacina_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Trigger de auditoria (Fase 3)
DROP TRIGGER IF EXISTS audit_vacina_catalog_trg ON public.vacina_catalog;
CREATE TRIGGER audit_vacina_catalog_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.vacina_catalog
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalogo_trigger();

-- 6) Seed do PNI 2026 aplicado a SST
INSERT INTO public.vacina_catalog (nome, doses_recomendadas, intervalo_doses, via_aplicacao, indicacao_ocupacional, contraindicacoes, origem, reforco_periodicidade, riscos_relacionados, categorias_profissionais, observacoes)
VALUES
  ('Hepatite B', 3, '0, 1 e 6 meses', 'Intramuscular (deltoide)',
   'OBRIGATÓRIA para trabalhadores com risco biológico (sangue e fluidos corporais). NR-32 exige comprovação.',
   'Alergia grave a componentes da vacina',
   'PNI', 'Reforço se anti-HBs < 10 mUI/mL',
   ARRAY['Risco Biológico', 'Perfurocortantes', 'Sangue e fluidos'],
   ARRAY['Profissionais de Saúde', 'Enfermagem', 'Técnicos de Laboratório', 'Coletores de Lixo', 'Bombeiros'],
   'Solicitar sorologia anti-HBs 30-60 dias após 3ª dose.'),

  ('dT (Difteria e Tétano)', 3, '0, 2 e 4 meses (esquema básico)', 'Intramuscular',
   'Todos os trabalhadores. Essencial para risco de ferimentos perfurocortantes.',
   'Reação grave a dose anterior',
   'PNI', 'A cada 10 anos ou 5 anos em caso de ferimento sujo',
   ARRAY['Acidente com Perfurocortante', 'Ferimentos', 'Corte'],
   ARRAY['Todos', 'Metalúrgicos', 'Soldadores', 'Construção Civil', 'Trabalhadores Rurais'],
   NULL),

  ('dTpa (Difteria, Tétano e Coqueluche)', 1, 'Dose única', 'Intramuscular',
   'Gestantes (a cada gestação) e profissionais de saúde em contato com recém-nascidos.',
   'Reação grave a dose anterior',
   'PNI', 'A cada gestação; a cada 10 anos para profissionais de saúde',
   ARRAY['Risco Biológico', 'Contato com recém-nascidos'],
   ARRAY['Profissionais de Saúde', 'Berçaristas', 'Neonatologistas'],
   'Substitui uma dose de dT no reforço.'),

  ('Febre Amarela', 1, 'Dose única a partir dos 9 meses', 'Subcutânea',
   'OBRIGATÓRIA para trabalhadores em áreas endêmicas (Amazônia, Centro-Oeste, parte do Sudeste). NR-31 para atividades rurais.',
   'Alergia a ovo, imunossupressão grave, gestantes (avaliar caso a caso)',
   'PNI', 'Dose única confere imunidade permanente (OMS 2016)',
   ARRAY['Área Endêmica', 'Trabalho a Céu Aberto', 'Áreas Rurais'],
   ARRAY['Trabalhadores Rurais', 'Militares', 'Guarda-Florestais', 'Turismólogos', 'Ecoturismo'],
   'Certificado Internacional obrigatório para viagens a áreas endêmicas.'),

  ('Tríplice Viral (Sarampo, Caxumba, Rubéola)', 2, '0 e 30 dias', 'Subcutânea',
   'Profissionais de saúde, educação e todos os trabalhadores nascidos após 1960 sem comprovação.',
   'Imunossupressão grave, gestantes',
   'PNI', 'Duas doses ao longo da vida',
   ARRAY['Risco Biológico', 'Contato com público'],
   ARRAY['Profissionais de Saúde', 'Educadores', 'Recepcionistas'],
   'Recomendada para todos os adultos até 59 anos sem comprovação vacinal.'),

  ('Influenza (Gripe)', 1, 'Anual', 'Intramuscular',
   'Todos os trabalhadores, especialmente profissionais de saúde, idosos e grupos de risco.',
   'Alergia grave a ovo (formas atenuadas)',
   'AMBAS', 'Anual (campanha do Ministério da Saúde)',
   ARRAY['Risco Biológico', 'Contato com público'],
   ARRAY['Todos', 'Profissionais de Saúde', 'Educadores', 'Servidores Públicos'],
   'Campanha nacional entre março e maio. Empresas podem oferecer via convênio.'),

  ('COVID-19', 2, 'Conforme fabricante (21-90 dias)', 'Intramuscular',
   'Todos os trabalhadores. Reforço anual recomendado a partir de 2024.',
   'Alergia grave a componentes da vacina',
   'PNI', 'Reforço anual (grupos prioritários) ou conforme atualização do PNI',
   ARRAY['Risco Biológico', 'Contato com público', 'Ambiente Confinado'],
   ARRAY['Todos'],
   'Esquema pode variar conforme fabricante. Consultar PNI vigente.'),

  ('Meningocócica ACWY', 1, 'Dose única (adultos)', 'Intramuscular',
   'Profissionais de saúde, laboratórios (Neisseria meningitidis) e trabalhadores em áreas de surto.',
   'Alergia grave a componentes da vacina',
   'PRIVADA', 'Reforço a cada 5 anos (grupos de risco)',
   ARRAY['Risco Biológico', 'Laboratório', 'Ambientes Aglomerados'],
   ARRAY['Profissionais de Saúde', 'Microbiologistas', 'Militares', 'Bombeiros'],
   'Disponível no PNI apenas para adolescentes. Para trabalhadores adultos: rede privada.'),

  ('Hepatite A', 2, '0 e 6 meses', 'Intramuscular',
   'Manipuladores de alimentos, trabalhadores em saneamento, viajantes a áreas endêmicas.',
   'Alergia grave a componentes da vacina',
   'AMBAS', 'Não requer reforço após esquema completo',
   ARRAY['Risco Biológico', 'Saneamento', 'Manipulação de Alimentos'],
   ARRAY['Manipuladores de Alimentos', 'Cozinheiros', 'Coletores de Lixo', 'Trabalhadores de Saneamento'],
   'PNI oferece apenas para crianças; adultos via rede privada ou CRIE.'),

  ('Raiva (Pré-exposição)', 3, '0, 7 e 28 dias', 'Intramuscular',
   'Veterinários, biólogos, tratadores de animais, agricultores e trabalhadores rurais.',
   'Nenhuma absoluta em pré-exposição',
   'PNI', 'Sorologia a cada 2 anos; reforço se título < 0,5 UI/mL',
   ARRAY['Contato com Animais', 'Trabalho Rural', 'Áreas Silvestres'],
   ARRAY['Veterinários', 'Biólogos', 'Guarda-Florestais', 'Agricultores', 'Trabalhadores Rurais'],
   'Disponível no CRIE (Centro de Referência de Imunobiológicos Especiais).');

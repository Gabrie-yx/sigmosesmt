-- 1) Add riscos jsonb column
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS riscos jsonb NOT NULL DEFAULT '{"fisicos":[],"quimicos":[],"ergonomicos":[],"descricao":""}'::jsonb;

-- 2) Upsert 8 standard shipyard roles (only insert if name not present; do not overwrite custom edits)
WITH seed(name, req_aso, req_integra, req_nrs, req_exames, riscos) AS (
  VALUES
  ('Operacional Metalurgia (Soldador/Maçariqueiro)', true, true, ARRAY['NR-06','NR-33','NR-34','NR-35']::text[],
    ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT']::text[],
    '{"fisicos":["Ruído","Calor","Radiações não ionizantes"],"quimicos":["Fumos metálicos (Ferro, Manganês, Cobre)","Poeiras"],"ergonomicos":["Postura inadequada","Levantamento de peso","Esforço repetitivo"],"descricao":"Operação de solda e maçarico em estruturas metálicas do estaleiro."}'::jsonb),
  ('Pintura e Tratamento (Pintor/Jatista)', true, true, ARRAY['NR-06','NR-33','NR-34','NR-35']::text[],
    ARRAY['ASO Clínico','Audiometria','Espirometria','Raio-X de Tórax OIT','Acuidade Visual']::text[],
    '{"fisicos":["Ruído","Vibração"],"quimicos":["Solventes orgânicos","Névoas de tinta","Poeiras de jateamento"],"ergonomicos":["Movimentos repetitivos","Trabalho em pé prolongado"],"descricao":"Aplicação de pintura industrial e jateamento abrasivo."}'::jsonb),
  ('Operacional Montagem (Montador/Auxiliar)', true, true, ARRAY['NR-06','NR-33','NR-34','NR-35']::text[],
    ARRAY['ASO Clínico','Audiometria','Espirometria']::text[],
    '{"fisicos":["Ruído","Vibração","Humidade"],"quimicos":["Poeiras metálicas","Partículas em suspensão"],"ergonomicos":["Esforço físico intenso","Posturas forçadas (trabalho dentro de blocos)"],"descricao":"Montagem de blocos e estruturas em ambiente confinado."}'::jsonb),
  ('Elétrica', true, true, ARRAY['NR-06','NR-10','NR-35']::text[],
    ARRAY['ASO Clínico','Audiometria','Acuidade Visual','ECG']::text[],
    '{"fisicos":["Ruído (indireto)","Radiações (soldas próximas)"],"quimicos":["Fumos de solda de estanho"],"ergonomicos":["Trabalho em altura","Esforço visual","Posturas em espaços exíguos"],"descricao":"Instalação e manutenção de sistemas elétricos a bordo."}'::jsonb),
  ('Movimentação de Cargas (Operador/Rigger)', true, true, ARRAY['NR-06','NR-11','NR-35']::text[],
    ARRAY['ASO Clínico','Audiometria','Acuidade Visual','ECG','EEG']::text[],
    '{"fisicos":["Ruído","Vibração de corpo inteiro"],"quimicos":["Gases de exaustão (motores)"],"ergonomicos":["Atenção difusa/fadiga mental","Postura sentada prolongada"],"descricao":"Operação de guindastes, pontes rolantes e amarração de cargas."}'::jsonb),
  ('Apoio e Serviços Gerais', true, true, ARRAY['NR-06']::text[],
    ARRAY['ASO Clínico','Audiometria']::text[],
    '{"fisicos":["Ruído","Humidade"],"quimicos":["Produtos de limpeza (saneantes)","Poeiras"],"ergonomicos":["Esforço físico","Posturas curvadas","Levantamento de cargas"],"descricao":"Limpeza, organização e apoio operacional ao estaleiro."}'::jsonb),
  ('Cozinha e Refeitório', true, true, ARRAY['NR-06']::text[],
    ARRAY['ASO Clínico','Acuidade Visual']::text[],
    '{"fisicos":["Calor excessivo","Humidade","Ruído"],"quimicos":["Vapores de gordura"],"ergonomicos":["Ritmo intenso","Trabalho em pé","Risco de queimaduras/cortes"],"descricao":"Preparo e distribuição de refeições para colaboradores."}'::jsonb),
  ('Administrativo e TST', true, true, ARRAY['NR-06']::text[],
    ARRAY['ASO Clínico','Acuidade Visual']::text[],
    '{"fisicos":["Ruído (pátio)","Iluminação inadequada"],"quimicos":["Poeiras (visitas ao pátio)"],"ergonomicos":["Postura sentada","Uso de ecrãs","Stress mental (fiscalização)"],"descricao":"Funções administrativas, fiscalização e suporte técnico."}'::jsonb)
)
INSERT INTO public.roles (name, req_aso, req_integra, req_nrs, req_exames, riscos)
SELECT s.name, s.req_aso, s.req_integra, s.req_nrs, s.req_exames, s.riscos
FROM seed s
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE lower(r.name) = lower(s.name));
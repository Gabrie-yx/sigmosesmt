INSERT INTO public.roles (name, req_aso, req_integra, req_nrs, req_exames, req_vacinas, risco_biologico, ativo, setor, cbo, cbo_titulo, descricao_atividades, atividades)
VALUES (
  'Agente de Portaria',
  true,
  true,
  ARRAY['NR-01','NR-06']::text[],
  ARRAY['ASO Clínico']::text[],
  ARRAY[]::text[],
  false,
  true,
  'Portaria',
  '5174-10',
  'Porteiro',
  'Controle de acesso de pessoas e veículos; registro de entradas/saídas; conferência de crachás e documentos; comunicação de ocorrências; apoio a evacuação e emergências.',
  'Controle de acesso, registro de entrada e saída de visitantes/veículos, conferência documental, rondas na guarita.'
);
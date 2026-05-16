INSERT INTO public.nao_conformidades (
  titulo, descricao, origem, severidade, status, data_identificacao, data_limite,
  emitente, departamento, classificacao, requisito, norma, reincidente, abrangencia,
  porques, acoes_imediatas_lista, acoes_corretivas_lista,
  acoes_implementadas, comentarios_implementacao,
  prazo_verificacao_eficacia, eficaz, comentarios_eficacia,
  data_fechamento, responsavel_fechamento
)
SELECT
  'Simulados trimestrais da CIPA sem evidência documental',
  'Constatado que, conforme ata da CIPA gestão 2024/2025, está definido o simulado trimestral, porém não foram apresentadas evidências documentais da sua realização conforme planejado.',
  'AUDITORIA', 'MEDIA', 'CONCLUIDA', '2025-10-17', '2025-11-05',
  'Arteniza Valente', 'SESMT', 'Não Conformidade', '8.1 / 9.1.1', 'ISO 9001:2015', false,
  'CIPA gestão 2024/2025 — DMN Estaleiro',
  '{"p1":"Porque os simulados não foram realizados conforme o cronograma estabelecido","p2":"Porque houve mudança na gestão da CIPA e formação de uma nova equipe de brigada.","p3":"Porque o novo grupo ainda estava em fase de organização e integração das responsabilidades.","p4":"Porque não existia um controle formal com prazos e responsáveis definidos para garantir o cumprimento do cronograma.","p5":"Porque não havia um procedimento periodicidade e forma de comprovação dos simulados"}'::jsonb,
  '[{"acao":"Revisar o cronograma de simulados com a Gestão da CIPA 2024/2025","responsavel":"Coord. CIPA","prazo":"2025-11-05"},{"acao":"Assegurando o devido registro em ATA","responsavel":"Secretário CIPA","prazo":"2025-11-05"}]'::jsonb,
  '[{"acao":"Responsabilizar pelo registros e cumprimento regular da programação definida pela CIPA","responsavel":"Presidente CIPA","prazo":"2025-11-28"},{"acao":"Realizar os simulados conforme o Cronograma estabelecido.","responsavel":"Brigada","prazo":"30 de cada mês"},{"acao":"Emitir Relatórios correspondentes e correções necessárias","responsavel":"SESMT","prazo":"a partir de dez/25"},{"acao":"Preservar registros para apresentar quando necessário","responsavel":"SGI","prazo":"contínuo"}]'::jsonb,
  true,
  'Ações imediatas e plano de ação implantado, Ata da CIPA e simulados e relatórios apresentados.',
  '2026-03-30', true,
  'Verificado que os documentos continuam atualizados e controlados. (Ata da CIPA, Cronograma de Simulado preservados.)',
  '2026-03-30', 'Arteniza Valente'
WHERE NOT EXISTS (
  SELECT 1 FROM public.nao_conformidades
   WHERE titulo = 'Simulados trimestrais da CIPA sem evidência documental'
);
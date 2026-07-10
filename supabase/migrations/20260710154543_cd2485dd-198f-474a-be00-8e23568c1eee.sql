
-- Corrige nomes/descrições dos 15 formulários FOR-SEG conforme padrão SGI oficial do usuário
UPDATE public.document_templates SET nome = 'Ordem de Serviço de Segurança',      descricao = 'Ordem de Serviço emitida por cargo/função (NR-01).', motor_render_id = 'oss'                 WHERE codigo = 'FOR-SEG-01';
UPDATE public.document_templates SET nome = 'Ficha de Entrega de EPI',             descricao = 'Ficha nominal de entrega de EPI ao colaborador.',    motor_render_id = 'epi-ficha'           WHERE codigo = 'FOR-SEG-02';
UPDATE public.document_templates SET nome = 'Requisição de Compra de Material',    descricao = 'Requisição de compra emitida pelo SESMT.',           motor_render_id = 'requisicao-compra'   WHERE codigo = 'FOR-SEG-03';
UPDATE public.document_templates SET nome = 'Permissão de Trabalho Especial',      descricao = 'PT emitida para trabalhos especiais (NR-33/35).',    motor_render_id = 'pte'                 WHERE codigo = 'FOR-SEG-04';
UPDATE public.document_templates SET nome = 'Permissão de Entrada e Trabalho em Espaço Confinado', descricao = 'PET emitida para atividades em espaço confinado (NR-33).', motor_render_id = 'pet' WHERE codigo = 'FOR-SEG-05';
UPDATE public.document_templates SET nome = 'Lista de Presença - DDS',             descricao = 'Lista de presença de DDS e treinamentos (FORCP-GP-05).', motor_render_id = 'lista-presenca'   WHERE codigo = 'FOR-SEG-06';
UPDATE public.document_templates SET nome = 'Análise Preliminar de Risco',         descricao = 'APR emitida por atividade.',                          motor_render_id = 'apr'                 WHERE codigo = 'FOR-SEG-07';
UPDATE public.document_templates SET nome = 'Planilha de Inspeção de Extintores',  descricao = 'Inspeção mensal de extintores.',                     motor_render_id = 'extintor'            WHERE codigo = 'FOR-SEG-08';
UPDATE public.document_templates SET nome = 'Quadro Estatístico de Acidentes de Trabalho', descricao = 'Estatísticas mensais de acidentes.',         motor_render_id = 'estatistico'         WHERE codigo = 'FOR-SEG-09';
UPDATE public.document_templates SET nome = 'Registro de Dias sem Acidentes',      descricao = 'Painel de dias sem acidentes.',                      motor_render_id = 'dias-sem-acidente'   WHERE codigo = 'FOR-SEG-10';
UPDATE public.document_templates SET nome = 'Calendário de Reuniões da CIPA',      descricao = 'Calendário anual da CIPA.',                          motor_render_id = NULL                  WHERE codigo = 'FOR-SEG-11';
UPDATE public.document_templates SET nome = 'Cronograma de Simulados de Emergência', descricao = 'Cronograma anual de simulados.',                  motor_render_id = NULL                  WHERE codigo = 'FOR-SEG-12';
UPDATE public.document_templates SET nome = 'Matriz de Treinamentos',              descricao = 'Matriz consolidada de treinamentos.',                motor_render_id = 'matriz-treinamento'  WHERE codigo = 'FOR-SEG-13';
UPDATE public.document_templates SET nome = 'Relatório de Investigação de Acidente', descricao = 'Relatório final de investigação (RIA).',           motor_render_id = 'ria'                 WHERE codigo = 'FOR-SEG-14';
UPDATE public.document_templates SET nome = 'Relatório de Simulado de Emergência', descricao = 'Relatório pós-simulado de emergência.',              motor_render_id = NULL                  WHERE codigo = 'FOR-SEG-15';

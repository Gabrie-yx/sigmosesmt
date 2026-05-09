
-- Criar novos cargos
INSERT INTO public.roles (name) VALUES
  ('Revisor Final'),
  ('Encarregado de Manutenção Mecânica'),
  ('Montador II'),
  ('Líder de Produção'),
  ('Encarregado de Produção/Montagem'),
  ('Montador I'),
  ('Operador de Máquinas Pesadas'),
  ('Almoxarife'),
  ('Auxiliar de Serviços Gerais'),
  ('Auxiliar de Montagem'),
  ('Eletricista Pleno'),
  ('Operador de Guindaste'),
  ('Eletricista Júnior'),
  ('Auxiliar de Almoxarifado')
ON CONFLICT DO NOTHING;

-- Remover funcionários seed da DMN
DELETE FROM public.employees WHERE company_id = '09795138-3af8-48ea-a558-7d90a2a89100';

-- Inserir nova lista
WITH r AS (SELECT id, name FROM public.roles)
INSERT INTO public.employees (company_id, nome, role_id, status)
VALUES
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'VALCEMIR DE OLIVEIRA MAIA', (SELECT id FROM r WHERE name='Revisor Final'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'RENATO OLIVEIRA BARBOSA', (SELECT id FROM r WHERE name='Encarregado de Manutenção Mecânica'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'DANIEL OLIVEIRA DE ABREU', (SELECT id FROM r WHERE name='Montador II'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'PAULO SERGIO DE SOUZA SILVA', (SELECT id FROM r WHERE name='Líder de Produção'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'MANOEL DA SILVA DE SOUZA', (SELECT id FROM r WHERE name='Encarregado de Produção/Montagem'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'FRANCISCO JUNIOR VIEIRA PALHETA', (SELECT id FROM r WHERE name='Soldador'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'SEGUNDO RAFAEL AMASIFUEN AQUITUARI', (SELECT id FROM r WHERE name='Montador II'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'ANTONIO FERREIRA DA SILVA', (SELECT id FROM r WHERE name='Montador I'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'MARCIO DA SILVA HONORATO', (SELECT id FROM r WHERE name='Operador de Máquinas Pesadas'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'ALEXANDRE FILGUEIRA SOARES', (SELECT id FROM r WHERE name='Almoxarife'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'JEFESTON NASCIMENTO DE FIGUEIREDO', (SELECT id FROM r WHERE name='Auxiliar de Serviços Gerais'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'VALDENIR LIMA DOS SANTOS', (SELECT id FROM r WHERE name='Auxiliar de Montagem'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'WILLIAM DE OLIVEIRA LIMA', (SELECT id FROM r WHERE name='Operador de Máquinas Pesadas'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'WILSON CONCEICAO DE ALMEIDA', (SELECT id FROM r WHERE name='Auxiliar de Montagem'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'NATANAEL MARINS DE LIRA', (SELECT id FROM r WHERE name='Eletricista Pleno'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'JOSE WILSON BANDEIRA DE SOUZA', (SELECT id FROM r WHERE name='Auxiliar de Serviços Gerais'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'ALDENIY NUNES CAMURCA', (SELECT id FROM r WHERE name='Operador de Guindaste'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'LEONARDO CARMO DOS SANTOS', (SELECT id FROM r WHERE name='Eletricista Júnior'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'ISRAEL UCHOA RENGIFO', (SELECT id FROM r WHERE name='Auxiliar de Almoxarifado'), 'ATIVO'),
  ('09795138-3af8-48ea-a558-7d90a2a89100', 'FRANCISCO BANDEIRA ALMEIDA', (SELECT id FROM r WHERE name='Técnico de Segurança'), 'ATIVO');

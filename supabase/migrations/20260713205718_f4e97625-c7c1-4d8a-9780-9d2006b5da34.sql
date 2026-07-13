
-- 1) Vínculo funcionário ↔ auth.users
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_user_id
  ON public.employees(user_id)
  WHERE user_id IS NOT NULL;

-- 2) Seed adicional do catálogo de itens (idempotente)
INSERT INTO public.catalogo_nrs_itens (nr_codigo, item, texto_oficial, prazo_dias_sugerido, gravidade_sugerida) VALUES
  ('NR-01','1.5.3.1','Cabe à organização identificar os perigos e, quando aplicável, avaliar os riscos ocupacionais, indicando o nível de risco.',30,'ALTO'),
  ('NR-01','1.5.4.4.1','A organização deve constituir e implementar o Programa de Gerenciamento de Riscos (PGR).',30,'ALTO'),
  ('NR-01','1.7.1','A organização deve proporcionar capacitação aos trabalhadores, com carga horária e conteúdo mínimos definidos nas NRs específicas.',30,'MODERADO'),
  ('NR-04','4.4.1','Cabe à organização constituir Serviço Especializado em Engenharia de Segurança e em Medicina do Trabalho (SESMT), conforme dimensionamento previsto.',60,'ALTO'),
  ('NR-05','5.4.1','A organização deve constituir por estabelecimento a Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA).',60,'ALTO'),
  ('NR-05','5.7.1','A CIPA deverá elaborar plano de trabalho que possibilite a ação preventiva na solução de problemas de segurança e saúde no trabalho.',30,'MODERADO'),
  ('NR-11','11.1.3.1','Nas operações de carga e descarga, transporte, movimentação e armazenagem de materiais deve ser observada a capacidade dos equipamentos e cargas.',15,'ALTO'),
  ('NR-11','11.1.6','Os equipamentos utilizados na movimentação de materiais devem ser calçados quando estacionados em rampa.',7,'ALTO'),
  ('NR-13','13.4.1.5','Toda caldeira deve possuir Prontuário atualizado, com dados relativos à construção, projeto, materiais, memorial de cálculo, testes e ART do PH.',30,'CRITICO'),
  ('NR-13','13.5.1.2','Todo vaso de pressão enquadrado na NR-13 deve possuir dispositivo de segurança contra sobrepressão.',15,'CRITICO'),
  ('NR-17','17.3.2','Os assentos utilizados nos postos de trabalho devem atender aos parâmetros mínimos de ergonomia previstos nesta norma.',60,'MODERADO'),
  ('NR-17','17.5.1','A organização deve realizar Análise Ergonômica Preliminar (AEP) das atividades que apresentem fatores de risco ergonômico.',60,'MODERADO'),
  ('NR-17','17.5.3','Quando os resultados da AEP demonstrarem a necessidade, deve ser elaborada a Análise Ergonômica do Trabalho (AET).',90,'MODERADO'),
  ('NR-18','18.5.1','Os canteiros de obras devem dispor de áreas de vivência com instalações sanitárias, vestiário, refeitório e local para descanso.',30,'ALTO'),
  ('NR-18','18.10.7','As áreas de circulação e passagens de trabalhadores em obras devem estar sempre desobstruídas.',3,'ALTO'),
  ('NR-18','18.13.1','É obrigatória a instalação de proteção coletiva onde houver risco de queda de trabalhadores ou de projeção de materiais.',3,'CRITICO'),
  ('NR-18','18.14.24','Os elevadores de transporte de material e de passageiros devem possuir Anotação de Responsabilidade Técnica (ART) do profissional habilitado.',15,'CRITICO'),
  ('NR-18','18.19.4','Ficam vedados o transporte e a permanência de trabalhadores sobre cargas suspensas.',1,'CRITICO'),
  ('NR-20','20.7.1','Toda instalação deve possuir Análise de Riscos (AR) contemplando todos os processos com inflamáveis e combustíveis.',30,'CRITICO'),
  ('NR-20','20.14.1','Todo trabalhador que atua em instalações de inflamáveis e combustíveis deve participar de curso específico conforme sua classificação.',30,'ALTO'),
  ('NR-23','23.4.1','O empregador deve providenciar a todos os trabalhadores informações sobre utilização dos equipamentos de combate ao incêndio e rotas de fuga.',30,'ALTO'),
  ('NR-23','23.11','Os equipamentos de combate a incêndio devem ser mantidos em condições de operação, com inspeções periódicas registradas.',15,'ALTO'),
  ('NR-26','26.2.1','A sinalização de segurança adotada no ambiente de trabalho deve seguir o padrão de cores previsto nesta NR.',30,'MODERADO'),
  ('NR-26','26.5.1','O produto químico utilizado no local de trabalho deve possuir rótulo e Ficha com Dados de Segurança (FDS) em português.',15,'ALTO'),
  ('NR-32','32.2.4.5.1','A vacinação dos trabalhadores dos serviços de saúde deve obedecer às recomendações do PCMSO.',30,'ALTO'),
  ('NR-32','32.2.4.16','Todo trabalhador com possibilidade de exposição a agentes biológicos deve utilizar vestimenta, calçado e outros EPIs adequados.',7,'ALTO'),
  ('NR-32','32.4.16.1','O empregador deve vedar a reencape e o descarte de agulhas em recipiente inadequado.',3,'CRITICO'),
  ('NR-06','6.6.2','O empregado deve responsabilizar-se pela guarda e conservação do EPI, comunicando qualquer alteração que o torne impróprio.',7,'MODERADO'),
  ('NR-10','10.2.4','As empresas devem manter esquemas unifilares atualizados das instalações elétricas de seus estabelecimentos.',30,'ALTO'),
  ('NR-10','10.7.1','Os trabalhos em instalações elétricas energizadas em AT, bem como aqueles executados no SEP, não podem ser realizados individualmente.',3,'CRITICO'),
  ('NR-12','12.5','Antes de iniciar a fabricação, importação, venda, locação, uso ou cessão a qualquer título, as máquinas devem atender aos requisitos desta NR.',60,'ALTO'),
  ('NR-33','33.3.4.1','O responsável técnico deve avaliar e classificar todos os espaços confinados do estabelecimento.',60,'ALTO'),
  ('NR-33','33.3.5.6','Deve ser garantida a comunicação entre trabalhadores autorizados, vigias e supervisor durante toda a atividade.',3,'CRITICO'),
  ('NR-34','34.5.9','A área destinada aos trabalhos a quente deve ser isolada e sinalizada, com anteparos ou barreiras físicas quando necessário.',3,'ALTO'),
  ('NR-34','34.7.1','Toda atividade envolvendo movimentação de cargas deve ser precedida de plano de rigging elaborado por profissional habilitado.',15,'CRITICO'),
  ('NR-35','35.4.1','Todo trabalho em altura deve ser planejado, organizado e executado por trabalhador capacitado e autorizado.',15,'CRITICO'),
  ('NR-35','35.5.3','Os sistemas de ancoragem devem ser dimensionados com carga mínima de ruptura de 22 kN por trabalhador conectado.',15,'CRITICO'),
  ('NR-35','35.6.1','O empregador deve organizar e disponibilizar equipe de resgate preparada para atender emergências em trabalho em altura.',30,'CRITICO'),
  ('NR-01','1.4.1','A organização deve cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho.',15,'ALTO'),
  ('NR-06','6.3','A empresa é obrigada a fornecer aos empregados, gratuitamente, EPI adequado ao risco, em perfeito estado de conservação.',7,'ALTO'),
  ('NR-11','11.1.7.1','Os operadores dos equipamentos de guindar devem possuir habilitação e treinamento específicos.',30,'ALTO'),
  ('NR-18','18.14.1','As máquinas, equipamentos e ferramentas utilizados nas obras devem obedecer aos dispositivos das NRs específicas.',30,'ALTO')
ON CONFLICT (nr_codigo, item) DO NOTHING;

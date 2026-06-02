-- =========================================================================
-- SEED PGR DMN ESTALEIRO 2026 — GHEs + Inventário (AIHA 5x5)
-- Idempotente. `risco` e `classificacao` são colunas geradas — não atualizar.
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pgr_ghe_numero_key') THEN
    ALTER TABLE public.pgr_ghe ADD CONSTRAINT pgr_ghe_numero_key UNIQUE (numero);
  END IF;
END $$;

INSERT INTO public.pgr_ghe (numero, setor, descricao_ambiente, qtd_colaboradores, jornada, ativo) VALUES
  (1,  'Administrativo',                'Escritórios administrativos — ambiente climatizado, iluminação artificial, mobiliário de escritório.', 8,  '08h-17h Seg-Sex', true),
  (2,  'Administrativo / Liderança',    'Salas de gerência e coordenação — ambiente climatizado.',                                                4,  '08h-17h Seg-Sex', true),
  (3,  'Produção — Caldeiraria',        'Pátio coberto e área aberta — corte, dobra e montagem de chapas metálicas.',                             18, '07h-17h Seg-Sex / Sáb 07-12h', true),
  (4,  'Produção — Soldagem',           'Cabines e área aberta — soldagem MIG/MAG, eletrodo revestido.',                                          15, '07h-17h Seg-Sex / Sáb 07-12h', true),
  (5,  'Produção — Pintura/Jateamento', 'Cabine de jato e pintura — abrasivo granalha, tintas epóxi.',                                            6,  '07h-17h Seg-Sex / Sáb 07-12h', true),
  (6,  'Almoxarifado',                  'Galpão coberto — recebimento, separação e expedição de materiais.',                                      4,  '07h-17h Seg-Sex', true),
  (7,  'SESMT / RH',                    'Sala SESMT/RH — ambiente climatizado.',                                                                  3,  '08h-17h Seg-Sex', true),
  (8,  'Produção — Mecânica/Montagem',  'Oficina mecânica — montagem de conjuntos navais.',                                                       10, '07h-17h Seg-Sex / Sáb 07-12h', true),
  (9,  'Produção — Elétrica/Eletrônica','Bancada e área de embarcação — instalação elétrica e eletrônica.',                                       6,  '07h-17h Seg-Sex / Sáb 07-12h', true),
  (10, 'Produção — Apoio/Carpintaria',  'Apoio à produção — carpintaria, andaimes, riggers.',                                                     8,  '07h-17h Seg-Sex / Sáb 07-12h', true)
ON CONFLICT (numero) DO UPDATE SET
  setor              = EXCLUDED.setor,
  descricao_ambiente = EXCLUDED.descricao_ambiente,
  qtd_colaboradores  = EXCLUDED.qtd_colaboradores,
  jornada            = EXCLUDED.jornada,
  ativo              = true,
  updated_at         = now();

DO $seed$
DECLARE
  v_ghe RECORD;
  v_ghe_id UUID;
BEGIN
  -- ADMIN (GHE 1, 2, 7) — riscos comuns
  FOR v_ghe IN SELECT id, numero FROM public.pgr_ghe WHERE numero IN (1, 2, 7) LOOP
    v_ghe_id := v_ghe.id;

    INSERT INTO public.pgr_inventario_riscos
      (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, monitoramento)
    SELECT v_ghe_id, 'ERGONOMICO', 'Postura sentada prolongada / uso de PVD',
      'LER/DORT, fadiga visual, cervicalgia', 'Trabalho em escritório com computador',
      'Mobiliário ergonômico, pausas, ginástica laboral', 'Habitual e permanente', 'Qualitativa', 3, 2,
      'AET anual (NR-17), reavaliação posto de trabalho'
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Postura sentada prolongada / uso de PVD');

    INSERT INTO public.pgr_inventario_riscos
      (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, monitoramento)
    SELECT v_ghe_id, 'ERGONOMICO', 'Fatores psicossociais (estresse, assédio, sobrecarga)',
      'Burnout, transtornos mentais (CID F)', 'Demandas, ritmo, relações interpessoais',
      'Canal de denúncia, política antiassédio, treinamento de gestores', 'Habitual', 'Qualitativa', 3, 3,
      'Pesquisa de clima anual, indicadores RH'
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Fatores psicossociais%');

    INSERT INTO public.pgr_inventario_riscos
      (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'QUIMICO', 'Álcool em gel 70%', 'Dermatite de contato, irritação ocular',
      'Higienização das mãos', 'Uso conforme indicação, FISPQ disponível', 'Eventual', 'Qualitativa', 2, 1
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Álcool em gel 70%');
  END LOOP;

  -- CALDEIRARIA (GHE 3)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 3;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, intensidade, unidade, limite_tolerancia, monitoramento)
    SELECT v_ghe_id, 'FISICO', 'Ruído contínuo/impacto', 'PAIR (perda auditiva)', 'Corte plasma, esmerilhadeira, marteleta',
      'Protetor auricular tipo concha + plug', 'Habitual e permanente', 'Quantitativa', 4, 3, 92, 'dB(A)', 85,
      'Audiometria anual (PCMSO), dosimetria anual'
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Ruído contínuo/impacto');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Projeção de partículas e cavacos', 'Lesão ocular, cortes', 'Corte e esmerilhamento',
      'Óculos ampla visão, protetor facial, EPC (anteparos)', 'Habitual', 'Qualitativa', 4, 3
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Projeção de partículas e cavacos');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Queda de materiais (içamento)', 'Fratura, óbito', 'Movimentação de chapas com ponte rolante',
      'Isolamento de área, sinalização, rigger qualificado', 'Habitual', 'Qualitativa', 3, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Queda de materiais (içamento)');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ERGONOMICO', 'Levantamento manual de cargas', 'Lombalgia, hérnia de disco', 'Manuseio de chapas/perfis',
      'Uso de talha/ponte rolante quando possível, treinamento NR-17', 'Habitual', 'Qualitativa', 3, 3
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Levantamento manual de cargas');
  END IF;

  -- SOLDAGEM (GHE 4)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 4;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, monitoramento)
    SELECT v_ghe_id, 'QUIMICO', 'Fumos metálicos (Fe, Mn, Cu)', 'Pneumoconiose, manganismo, febre dos fumos',
      'Soldagem MIG/MAG e eletrodo', 'Exaustão localizada, máscara PFF2 com filtro químico',
      'Habitual e permanente', 'Quantitativa', 4, 4, 'Espirometria + Rx tórax anual (PCMSO), amostragem ambiental anual'
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Fumos metálicos (Fe, Mn, Cu)');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'FISICO', 'Radiação não-ionizante (UV/IR do arco)', 'Ceratite actínica, queimadura de pele',
      'Arco voltaico de soldagem', 'Máscara de solda auto-escurecimento, mangas e perneiras de raspa',
      'Habitual e permanente', 'Qualitativa', 4, 3
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Radiação não-ionizante%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, intensidade, unidade, limite_tolerancia)
    SELECT v_ghe_id, 'FISICO', 'Calor (IBUTG)', 'Câimbras, exaustão, intermação',
      'Soldagem em área aberta + EPI pesado', 'Hidratação, pausas, área de descanso climatizada',
      'Habitual', 'Quantitativa', 3, 3, 27.5, 'ºC IBUTG', 26.7
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Calor (IBUTG)');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Incêndio / explosão', 'Queimaduras graves, óbito',
      'Faísca + materiais combustíveis', 'PT de trabalho a quente, vigia de fogo, extintor próximo',
      'Habitual', 'Qualitativa', 3, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Incêndio / explosão');
  END IF;

  -- PINTURA/JATEAMENTO (GHE 5)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 5;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, monitoramento)
    SELECT v_ghe_id, 'QUIMICO', 'Solventes orgânicos (xileno, tolueno)', 'Neurotoxicidade, hepatotoxicidade',
      'Tinta epóxi e poliuretana', 'Cabine ventilada, máscara facial inteira com filtro VO/AG',
      'Habitual e permanente', 'Quantitativa', 4, 4, 'TGO/TGP, hemograma, ácido hipúrico/metilhipúrico (PCMSO)'
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Solventes orgânicos%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, monitoramento)
    SELECT v_ghe_id, 'QUIMICO', 'Poeira de jateamento (sílica/granalha)', 'Silicose, pneumoconiose',
      'Jato abrasivo', 'Capacete com ar mandado (fluxo contínuo), cabine fechada',
      'Habitual e permanente', 'Quantitativa', 4, 5, 'Espirometria + Rx tórax OIT anual (PCMSO)'
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Poeira de jateamento%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, intensidade, unidade, limite_tolerancia)
    SELECT v_ghe_id, 'FISICO', 'Ruído (jato)', 'PAIR',
      'Compressor + jato abrasivo', 'Protetor auricular duplo (concha+plug), enclausuramento',
      'Habitual', 'Quantitativa', 4, 3, 105, 'dB(A)', 85
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Ruído (jato)');
  END IF;

  -- ALMOXARIFADO (GHE 6)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 6;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ERGONOMICO', 'Levantamento e transporte manual de cargas', 'Lombalgia, DORT',
      'Movimentação de materiais', 'Empilhadeira/paleteira, treinamento NR-17', 'Habitual', 'Qualitativa', 4, 3
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Levantamento e transporte%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Queda de objetos armazenados em altura', 'Contusão, fratura',
      'Estantes verticais', 'Sinalização, escadas adequadas, estoque organizado por peso', 'Habitual', 'Qualitativa', 3, 3
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Queda de objetos%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Atropelamento por empilhadeira', 'Politraumatismo, óbito',
      'Operação de empilhadeira em área compartilhada', 'Faixas de pedestre, sinalização sonora, NR-11', 'Habitual', 'Qualitativa', 2, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Atropelamento%');
  END IF;

  -- MECÂNICA/MONTAGEM (GHE 8)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 8;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade, intensidade, unidade, limite_tolerancia)
    SELECT v_ghe_id, 'FISICO', 'Ruído de oficina', 'PAIR', 'Ferramentas pneumáticas e elétricas',
      'Protetor auricular, enclausuramento de máquinas', 'Habitual', 'Quantitativa', 3, 3, 88, 'dB(A)', 85
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Ruído de oficina');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'QUIMICO', 'Óleos e graxas minerais', 'Dermatose, foliculite',
      'Lubrificação de máquinas', 'Luva nitrílica, creme barreira', 'Habitual', 'Qualitativa', 3, 2
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Óleos e graxas minerais');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Esmagamento entre partes móveis', 'Amputação, fratura',
      'Montagem e ajuste mecânico', 'Bloqueio e etiquetagem (LOTO), proteção de máquinas', 'Habitual', 'Qualitativa', 2, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Esmagamento%');
  END IF;

  -- ELÉTRICA (GHE 9)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 9;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Choque elétrico (NR-10)', 'Fibrilação, queimadura, óbito',
      'Instalação e manutenção elétrica', 'NR-10 básico/SEP, EPI dielétrico, PT, bloqueio (LOTO)', 'Habitual', 'Qualitativa', 3, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Choque elétrico%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Trabalho em altura', 'Queda com lesão grave/fatal',
      'Instalação em mastros, conveses elevados', 'NR-35, cinto paraquedista, linha de vida, ancoragem', 'Habitual', 'Qualitativa', 3, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Trabalho em altura');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Espaço confinado (tanques/porões)', 'Asfixia, intoxicação, óbito',
      'Acesso a interior de embarcação', 'NR-33, supervisor e vigia, monitor de gases, PT', 'Eventual', 'Qualitativa', 2, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Espaço confinado%');
  END IF;

  -- APOIO/CARPINTARIA (GHE 10)
  SELECT id INTO v_ghe_id FROM public.pgr_ghe WHERE numero = 10;
  IF v_ghe_id IS NOT NULL THEN
    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Trabalho em altura (montagem de andaime)', 'Queda fatal',
      'Montagem/desmontagem de andaime', 'NR-35 + NR-18, cinto, andaimes certificados', 'Habitual', 'Qualitativa', 3, 5
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Trabalho em altura%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'ACIDENTE', 'Corte com ferramentas manuais/elétricas', 'Lacerações, amputação',
      'Serra circular, plaina, formão', 'Proteção das máquinas, luva anti-corte, treinamento', 'Habitual', 'Qualitativa', 3, 3
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo LIKE 'Corte com ferramentas%');

    INSERT INTO public.pgr_inventario_riscos (ghe_id, categoria, perigo, agravo, fonte_geradora, controles_existentes, exposicao, tipo_avaliacao, probabilidade, severidade)
    SELECT v_ghe_id, 'QUIMICO', 'Poeira de madeira', 'Asma ocupacional, rinite',
      'Corte e lixamento de madeira', 'Exaustão localizada, máscara PFF2', 'Habitual', 'Qualitativa', 3, 2
    WHERE NOT EXISTS (SELECT 1 FROM public.pgr_inventario_riscos WHERE ghe_id = v_ghe_id AND perigo = 'Poeira de madeira');
  END IF;
END $seed$;
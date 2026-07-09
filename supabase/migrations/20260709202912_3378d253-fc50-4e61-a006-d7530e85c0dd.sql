
INSERT INTO public.catalogo_riscos
  (categoria, nome, codigo_esocial, aposentadoria_especial_anos, efeitos_tipicos, medidas_controle_padrao, nrs_aplicaveis, epis_sugeridos, ativo)
VALUES
  ('QUIMICO','Fumos metálicos de solda','01.18.001',25,
    ARRAY['Febre dos fumos metálicos','Pneumoconiose','Irritação respiratória','Manganismo (fumos de Mn)'],
    ARRAY['Ventilação local exaustora na fonte','Rodízio de tarefas','Cabines de solda ventiladas'],
    ARRAY['NR-06','NR-09','NR-15 Anexo 13'],
    ARRAY['Máscara PFF2/PFF3','Respirador com filtro P3','Máscara de solda com exaustão','Avental de raspa'], true),

  ('QUIMICO','Poeira de sílica cristalina','01.16.001',15,
    ARRAY['Silicose','Câncer de pulmão','Doença renal'],
    ARRAY['Umidificação','Aspiração','Enclausuramento da fonte','Substituição do abrasivo'],
    ARRAY['NR-06','NR-09','NR-15 Anexo 12','NR-22'],
    ARRAY['Respirador PFF3','Máscara facial inteira com filtro P3','Óculos de proteção'], true),

  ('QUIMICO','Monóxido de carbono (CO)','01.11.001',NULL,
    ARRAY['Cefaléia','Tontura','Perda de consciência','Óbito por asfixia química'],
    ARRAY['Ventilação forçada','Monitor pessoal de CO','Isolamento de motores a combustão'],
    ARRAY['NR-06','NR-09','NR-15 Anexo 11','NR-33'],
    ARRAY['Detector de gases','Máscara autônoma (em confinado)'], true),

  ('QUIMICO','Ozônio (solda MIG/TIG)','01.14.001',NULL,
    ARRAY['Irritação de vias aéreas','Edema pulmonar','Tosse'],
    ARRAY['Ventilação local exaustora','Distância segura da poça de solda'],
    ARRAY['NR-06','NR-09','NR-15 Anexo 11'],
    ARRAY['Respirador com filtro para gases ácidos'], true),

  ('QUIMICO','Névoas e vapores de tinta / solventes','01.20.028',NULL,
    ARRAY['Cefaléia','Dermatite','Intoxicação por hidrocarbonetos','Efeitos neurológicos'],
    ARRAY['Cabine de pintura ventilada','Substituição por tinta base água','Controle de tempo de exposição'],
    ARRAY['NR-06','NR-09','NR-15 Anexo 11 e 13'],
    ARRAY['Respirador com filtro VO/GA','Luva nitrílica','Macacão Tyvek','Óculos ampla visão'], true),

  ('QUIMICO','Poeira de esmerilhamento (metálica)',NULL,NULL,
    ARRAY['Irritação respiratória','Pneumoconiose por metais'],
    ARRAY['Aspiração na fonte','Uso de disco adequado','Anteparos'],
    ARRAY['NR-06','NR-09','NR-12'],
    ARRAY['Máscara PFF2','Óculos ampla visão','Protetor facial'], true),

  ('QUIMICO','Óleos e graxas minerais',NULL,NULL,
    ARRAY['Dermatite de contato','Foliculite','Câncer de pele (exposição crônica)'],
    ARRAY['Cremes de proteção','Higienização','Substituição por óleos vegetais'],
    ARRAY['NR-06','NR-09'],
    ARRAY['Luva nitrílica','Creme barreira'], true),

  ('FISICO','Iluminação inadequada',NULL,NULL,
    ARRAY['Fadiga visual','Cefaléia','Aumento do risco de acidente'],
    ARRAY['Medição de lux (NBR ISO 8995)','Reposição de luminárias','Iluminação de tarefa'],
    ARRAY['NR-17','NR-24'],
    ARRAY[]::text[], true),

  ('ERGONOMICO','Trabalho sentado prolongado',NULL,NULL,
    ARRAY['Lombalgia','Distúrbios circulatórios MMII','Fadiga'],
    ARRAY['Pausas','Cadeira ergonômica NR-17','Ginástica laboral'],
    ARRAY['NR-17'],
    ARRAY[]::text[], true),

  ('ERGONOMICO','Trabalho em pé prolongado',NULL,NULL,
    ARRAY['Varizes','Lombalgia','Fadiga MMII'],
    ARRAY['Estrado antifadiga','Pausas','Rodízio de postos'],
    ARRAY['NR-17'],
    ARRAY['Calçado ergonômico'], true),

  ('ERGONOMICO','Pressão psicológica / cobrança excessiva',NULL,NULL,
    ARRAY['Estresse','Ansiedade','Burnout','LER/DORT agravado'],
    ARRAY['Gestão de metas realistas','PGR psicossocial','Canal de escuta'],
    ARRAY['NR-01','NR-17'],
    ARRAY[]::text[], true),

  ('ACIDENTE_MECANICO','Prensagem / esmagamento em máquinas',NULL,NULL,
    ARRAY['Amputação','Fratura','Óbito'],
    ARRAY['Proteções fixas/móveis intertravadas','Bimanual','Parada de emergência','LOTO'],
    ARRAY['NR-06','NR-10','NR-12'],
    ARRAY['Luva anticorte','Óculos','Botina biqueira composite'], true),

  ('ACIDENTE_MECANICO','Corte por ferramenta / chapa',NULL,NULL,
    ARRAY['Lacerações','Tendões seccionados','Infecção'],
    ARRAY['Rebarbação de bordas','Ferramenta adequada','Bancadas organizadas'],
    ARRAY['NR-06','NR-12'],
    ARRAY['Luva anticorte nível D/E','Manguito','Avental de raspa'], true),

  ('ACIDENTE_MECANICO','Soterramento em escavação',NULL,NULL,
    ARRAY['Asfixia','Fraturas','Óbito'],
    ARRAY['Escoramento','Talude seguro','Análise geotécnica','Sinalização'],
    ARRAY['NR-18'],
    ARRAY['Capacete','Botina cano longo','Colete refletivo'], true),

  ('ACIDENTE_MECANICO','Colisão / abalroamento (trânsito interno)',NULL,NULL,
    ARRAY['Politraumatismo','Óbito'],
    ARRAY['Rotas segregadas pedestre x veículo','Limite de velocidade','Sinalização','Espelhos'],
    ARRAY['NR-11','NR-12'],
    ARRAY['Colete refletivo classe II'], true),

  ('BIOLOGICO','Fungos e mofo (ambiente úmido)',NULL,NULL,
    ARRAY['Rinite','Asma ocupacional','Micoses'],
    ARRAY['Controle de umidade','Ventilação','Limpeza periódica'],
    ARRAY['NR-09','NR-32'],
    ARRAY['Máscara PFF2','Luva de PVC'], true);

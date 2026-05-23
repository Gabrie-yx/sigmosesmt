
DO $$
DECLARE
  v_user UUID := '5e261d52-fada-499e-befb-eb5cc9866a3b';
  v_nc_id UUID;
BEGIN
  INSERT INTO public.nao_conformidades (
    titulo, descricao, origem, severidade, status,
    data_identificacao, classificacao, norma, emitente, created_by
  ) VALUES (
    'Vazamento de óleo na prensa hidráulica #3',
    'Durante inspeção de rotina foi identificado vazamento de óleo hidráulico na base da prensa #3, gerando risco de escorregamento e contaminação ambiental.',
    'INSPECAO_SST', 'ALTA', 'ABERTA',
    CURRENT_DATE, 'Não Conformidade', 'ISO 45001:2018', 'Gabriel Almeida', v_user
  ) RETURNING id INTO v_nc_id;

  INSERT INTO public.plano_acoes (
    nc_id, titulo, descricao, como, onde, quando,
    responsavel_id, prioridade, status, origem_acao, created_by
  ) VALUES (
    v_nc_id,
    'Trocar vedação hidráulica e limpar área da prensa #3',
    'Substituir o conjunto de vedação do cilindro principal e realizar limpeza completa do piso, com bandeja de contenção.',
    'Acionar manutenção mecânica; trocar retentor e o-ring; testar pressão; limpar piso com absorvente; instalar bandeja.',
    'Setor de Estamparia — Prensa Hidráulica #3',
    CURRENT_DATE + INTERVAL '7 days',
    v_user, 'ALTA', 'EM_ANDAMENTO', 'INSPECAO_SST', v_user
  );

  INSERT INTO public.plano_acoes (
    titulo, descricao, como, onde, quando,
    responsavel_id, prioridade, status, origem_acao, created_by
  ) VALUES (
    'Implementar checklist diário de pré-uso nas empilhadeiras',
    'Padronizar verificação diária dos itens críticos (freio, buzina, luzes, vazamentos, cinto) antes do turno.',
    'Elaborar formulário, treinar operadores no DDS, definir responsável por validação no início de cada turno.',
    'Pátio de logística — todas as empilhadeiras',
    CURRENT_DATE + INTERVAL '15 days',
    v_user, 'MEDIA', 'PENDENTE', 'OUTRO', v_user
  );
END $$;


DO $$
DECLARE
  v_apr_id uuid;
  v_numero text;
  v_modelo record;
  v_risco jsonb;
  v_ordem int;
  v_frentes text[][] := ARRAY[
    ARRAY['jateamento-altura-costado',     'Pintura e jateamento em altura no costado do casco — frente da semana'],
    ARRAY['solda-altura-casco',            'Solda em estrutura metálica interna do casco — frente da semana'],
    ARRAY['corte-solda-costado-oxicorte',  'Oxicorte no costado do casco em galpão de produção — frente da semana'],
    ARRAY['icamento-longarina',            'Içamento e montagem de longarina/cobertura metálica no canteiro — frente da semana'],
    ARRAY['solda-montagem-estrutura-baixa','Solda, furação e montagem em estrutura metálica baixa no galpão — frente da semana']
  ];
  v_frente text[];
BEGIN
  FOREACH v_frente SLICE 1 IN ARRAY v_frentes
  LOOP
    SELECT * INTO v_modelo FROM public.apr_modelos WHERE codigo = v_frente[1] AND ativo = true;
    IF v_modelo.id IS NULL THEN
      RAISE NOTICE 'Modelo % não encontrado, pulando', v_frente[1];
      CONTINUE;
    END IF;

    v_numero := public.gerar_numero_apr();

    INSERT INTO public.aprs (
      numero, atividade_descricao, exige_pte, validade_dias,
      data_emissao, data_validade,
      condicoes_climaticas, observacoes_gerais,
      status, dias_semana
    ) VALUES (
      v_numero,
      v_frente[2],
      true,
      15,
      CURRENT_DATE,
      CURRENT_DATE + 15,
      v_modelo.condicoes_climaticas,
      v_modelo.observacoes_gerais,
      'RASCUNHO',
      ARRAY['SEG','TER','QUA','QUI','SEX']
    ) RETURNING id INTO v_apr_id;

    v_ordem := 0;
    FOR v_risco IN SELECT * FROM jsonb_array_elements(v_modelo.riscos)
    LOOP
      v_ordem := v_ordem + 1;
      INSERT INTO public.apr_riscos (
        apr_id, ordem,
        risco_nome, risco_categoria, efeitos_danos,
        probabilidade, severidade,
        acoes_preventivas, epis, nrs,
        passo_a_passo
      ) VALUES (
        v_apr_id, v_ordem,
        COALESCE(v_risco->>'risco_nome',''),
        v_risco->>'risco_categoria',
        v_risco->>'efeitos_danos',
        COALESCE((v_risco->>'probabilidade')::int, 1),
        COALESCE((v_risco->>'severidade')::int, 1),
        v_risco->>'acoes_preventivas',
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_risco->'epis')), ARRAY[]::text[]),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_risco->'nrs')),  ARRAY[]::text[]),
        v_risco->>'passo_a_passo'
      );
    END LOOP;
  END LOOP;
END $$;

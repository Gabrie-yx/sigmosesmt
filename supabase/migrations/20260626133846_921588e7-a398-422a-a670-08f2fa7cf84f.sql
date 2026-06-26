
INSERT INTO public.producao_fatores_consumo
  (tipo_embarcacao, categoria, unidade, fator_por_ton_aco, fonte, cascos_base, observacao, recalculado_em, travado)
VALUES
  ('BALSA GRANELEIRA','SOLDA','KG',  20.42, 'AUTO', 6, 'Média 6 cascos (130–135): 31.557 kg solda / 1.545,38 ton aço', now(), false),
  ('BALSA GRANELEIRA','GÁS',  'KG',  16.60, 'AUTO', 6, 'Média 6 cascos (130–135): 25.650 kg gás / 1.545,38 ton aço', now(), false),
  ('BALSA GRANELEIRA','TINTA','GAL',  0.17, 'AUTO', 4, 'Média 4 cascos (130–133): 206 gal / 1.200,14 ton aço', now(), false)
ON CONFLICT (tipo_embarcacao, categoria, unidade) DO UPDATE
  SET fator_por_ton_aco = EXCLUDED.fator_por_ton_aco,
      fonte             = EXCLUDED.fonte,
      cascos_base       = EXCLUDED.cascos_base,
      observacao        = EXCLUDED.observacao,
      recalculado_em    = EXCLUDED.recalculado_em,
      updated_at        = now()
  WHERE public.producao_fatores_consumo.travado = false;

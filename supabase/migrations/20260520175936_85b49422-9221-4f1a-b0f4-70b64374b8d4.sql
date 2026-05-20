-- GÁS — qualquer descrição com termos típicos
UPDATE public.producao_base_materia_prima SET tipo = 'GÁS', updated_at = now()
 WHERE tipo = 'OUTROS' AND descricao ~* '(\moxig|\macetilen|\margo[nm]|\mnitrog|\mco2\M|\bgas\b|\bgás\b|\bcarga\s+de\s+gas\b|\bcilindro\b)';

-- SOLDA — eletrodos, arames de solda, Denver, fluxos
UPDATE public.producao_base_materia_prima SET tipo = 'SOLDA', updated_at = now()
 WHERE tipo = 'OUTROS' AND descricao ~* '(\meletrod|\barame\s+tubular\b|\barame.*weld|\barame.*mig|\barame.*solda|\bdenver\b|\bfluxo\s+sold|\bvareta\s+(tig|mig|solda)|\bweld\s*71|\b(7018|6013|e71t|er70|er-?70|ok\s*33\.80|ok\s*48)\b|\bsolda\s+ok\b)';

-- TINTA — primer, esmalte, epóxi, thinner, diluente
UPDATE public.producao_base_materia_prima SET tipo = 'TINTA', updated_at = now()
 WHERE tipo = 'OUTROS' AND descricao ~* '(\mtinta|\mprimer|\mesmalte|\mepox|\mthinner|\mdiluen|\msolvent|\mverniz|\bfundo\s+(epoxi|anti)|intertuf|interzone|interprime|interlac|intershield|sigmacover|hempel|jotun)';

-- FERRO/AÇO — chapas, cantoneiras, tubos, barras, perfis, vergalhão,
-- flanges, curvas, reduções, peças de aço carbono em geral
UPDATE public.producao_base_materia_prima SET tipo = 'FERRO', updated_at = now()
 WHERE tipo = 'OUTROS' AND descricao ~* '(\mchapa|\mcantone|\mcant\s+\d|\mperfil|\mbarra\s+(chata|redonda|quadrada|sextavada)|\mvergalh|\btubo\s+(sch|ind|fq|galv|a/c|s/cost|s\.?cost)|\btubo\s+de\s+a[çc]o|\btubo\s+ms\b|\btarugo|\btrefilad|\ba36\b|\b1020\b|\b1045\b|\bcurva\s+\d+°|\bflange\s+(sobreposto|cego|com\s+pesco|slip)|\bredu[çc][aã]o\s+(conc|exc)|\bcot[ov]elo\b|\bniple\b|\bvergalh[aã]o)';

-- Pega ainda chapa xadrez, chapa de alumínio listada genericamente e itens
-- "TUBO ... 6000" que sobraram
UPDATE public.producao_base_materia_prima SET tipo = 'FERRO', updated_at = now()
 WHERE tipo = 'OUTROS' AND descricao ~* '(\bchapa\b|\bcantoneira\b|\btubo\b.*\bx\s*\d|\bbarra\b.*\bx\s*\d)';

-- 1) Novos campos em rc_cotacao_itens (conformidade por item)
ALTER TABLE public.rc_cotacao_itens
  ADD COLUMN IF NOT EXISTS conformidade TEXT NOT NULL DEFAULT 'CONFORME'
    CHECK (conformidade IN ('CONFORME','SIMILAR','DIVERGENTE','NAO_COTADO')),
  ADD COLUMN IF NOT EXISTS justificativa_conformidade TEXT;

-- 2) Novos campos em rc_cotacoes (cobertura)
ALTER TABLE public.rc_cotacoes
  ADD COLUMN IF NOT EXISTS cobertura_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itens_cotados INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itens_totais_rc INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tem_divergencias BOOLEAN DEFAULT false;

-- 3) Recalcular cobertura
CREATE OR REPLACE FUNCTION public.recalcular_cobertura_cotacao(_cotacao_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rc UUID; v_total INT; v_cotados INT; v_divergentes INT;
BEGIN
  SELECT rc_id INTO v_rc FROM public.rc_cotacoes WHERE id = _cotacao_id;
  IF v_rc IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_total FROM public.purchase_requisition_items WHERE requisition_id = v_rc;
  SELECT
    COUNT(*) FILTER (WHERE conformidade <> 'NAO_COTADO' AND valor_unitario > 0),
    COUNT(*) FILTER (WHERE conformidade = 'DIVERGENTE')
  INTO v_cotados, v_divergentes
  FROM public.rc_cotacao_itens WHERE cotacao_id = _cotacao_id;

  UPDATE public.rc_cotacoes
     SET itens_totais_rc = COALESCE(v_total, 0),
         itens_cotados = COALESCE(v_cotados, 0),
         cobertura_pct = CASE WHEN COALESCE(v_total,0) > 0
                              THEN ROUND((v_cotados::NUMERIC / v_total) * 100, 2) ELSE 0 END,
         tem_divergencias = COALESCE(v_divergentes, 0) > 0
   WHERE id = _cotacao_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_cobertura_cotacao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.recalcular_cobertura_cotacao(COALESCE(NEW.cotacao_id, OLD.cotacao_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_rc_cotacao_itens_cobertura ON public.rc_cotacao_itens;
CREATE TRIGGER trg_rc_cotacao_itens_cobertura
AFTER INSERT OR UPDATE OR DELETE ON public.rc_cotacao_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_cobertura_cotacao();

-- 5) Matriz v2
CREATE OR REPLACE FUNCTION public.calcular_scores_rc(_rc_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; _min_valor NUMERIC; _min_prazo NUMERIC;
BEGIN
  SELECT MIN(NULLIF(valor,0)) INTO _min_valor
    FROM public.rc_cotacoes WHERE rc_id = _rc_id AND COALESCE(cobertura_pct,0) >= 80;
  IF _min_valor IS NULL THEN
    SELECT MIN(NULLIF(valor,0)) INTO _min_valor FROM public.rc_cotacoes WHERE rc_id = _rc_id;
  END IF;
  SELECT MIN(NULLIF(prazo_entrega_dias,0)) INTO _min_prazo
    FROM public.rc_cotacoes WHERE rc_id = _rc_id;

  FOR r IN
    SELECT c.id, c.valor, c.prazo_entrega_dias, c.condicao_pagamento, c.frete,
           COALESCE(c.cobertura_pct, 0) AS cobertura_pct,
           COALESCE(c.tem_divergencias, false) AS tem_divergencias,
           COALESCE(f.estrelas, 3) AS estrelas
    FROM public.rc_cotacoes c
    LEFT JOIN public.fornecedores f ON f.id = c.fornecedor_id
    WHERE c.rc_id = _rc_id
  LOOP
    DECLARE
      s_preco NUMERIC := 0; s_prazo NUMERIC := 0; s_estrelas NUMERIC := 0;
      s_pagamento NUMERIC := 0; s_frete NUMERIC := 0; s_cobertura NUMERIC := 0;
      dias_pgto INT := 30; total NUMERIC; breakdown JSONB; penalidade NUMERIC := 1.0;
    BEGIN
      IF r.valor IS NOT NULL AND r.valor > 0 AND _min_valor IS NOT NULL AND _min_valor > 0 THEN
        s_preco := LEAST(1.0, _min_valor / r.valor) * 25;
      END IF;
      IF r.prazo_entrega_dias IS NOT NULL AND r.prazo_entrega_dias > 0 AND _min_prazo IS NOT NULL AND _min_prazo > 0 THEN
        s_prazo := LEAST(1.0, _min_prazo::NUMERIC / r.prazo_entrega_dias) * 15;
      ELSIF r.prazo_entrega_dias IS NULL AND _min_prazo IS NULL THEN
        s_prazo := 7.5;
      END IF;
      s_estrelas := (r.estrelas::NUMERIC / 5.0) * 20;
      IF r.condicao_pagamento IS NOT NULL THEN
        SELECT COALESCE(MAX((m[1])::INT),30) INTO dias_pgto
          FROM regexp_matches(r.condicao_pagamento, '([0-9]{1,3})', 'g') AS m;
        s_pagamento := LEAST(1.0, dias_pgto::NUMERIC / 90.0) * 10;
      ELSE s_pagamento := 3; END IF;
      IF r.frete IS NOT NULL AND UPPER(r.frete) LIKE '%CIF%' THEN s_frete := 5;
      ELSIF r.frete IS NOT NULL AND UPPER(r.frete) LIKE '%FOB%' THEN s_frete := 2;
      ELSE s_frete := 2.5; END IF;
      s_cobertura := (r.cobertura_pct / 100.0) * 25;
      IF r.tem_divergencias THEN penalidade := 0.90; END IF;
      total := ROUND((s_preco + s_prazo + s_estrelas + s_pagamento + s_frete + s_cobertura) * penalidade, 2);
      breakdown := jsonb_build_object(
        'preco', ROUND(s_preco,2), 'prazo_entrega', ROUND(s_prazo,2),
        'estrelas', ROUND(s_estrelas,2), 'condicao_pagamento', ROUND(s_pagamento,2),
        'frete', ROUND(s_frete,2), 'cobertura', ROUND(s_cobertura,2),
        'cobertura_pct', r.cobertura_pct, 'estrelas_fornecedor', r.estrelas,
        'dias_pagamento_detectado', dias_pgto,
        'penalidade_divergencia', CASE WHEN r.tem_divergencias THEN '10%' ELSE 'nenhuma' END,
        'pesos', jsonb_build_object('preco',25,'prazo',15,'estrelas',20,'pagamento',10,'frete',5,'cobertura',25)
      );
      UPDATE public.rc_cotacoes
         SET score_total = total, score_breakdown = breakdown, analisado_em = now()
       WHERE id = r.id;
    END;
  END LOOP;

  UPDATE public.rc_cotacoes SET is_melhor_oferta = false, ranking = NULL WHERE rc_id = _rc_id;
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY score_total DESC NULLS LAST, valor ASC NULLS LAST) AS rk
    FROM public.rc_cotacoes WHERE rc_id = _rc_id
  )
  UPDATE public.rc_cotacoes c
     SET ranking = ranked.rk::SMALLINT, is_melhor_oferta = (ranked.rk = 1)
    FROM ranked WHERE ranked.id = c.id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_cotacao_recalcula_scores()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.cobertura_pct IS DISTINCT FROM NEW.cobertura_pct
    OR OLD.tem_divergencias IS DISTINCT FROM NEW.tem_divergencias
  ) THEN
    PERFORM public.calcular_scores_rc(NEW.rc_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rc_cotacoes_cobertura_score ON public.rc_cotacoes;
CREATE TRIGGER trg_rc_cotacoes_cobertura_score
AFTER UPDATE ON public.rc_cotacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_cotacao_recalcula_scores();

-- 7) Melhor combo por item
CREATE OR REPLACE FUNCTION public.melhor_combo_por_item(_rc_id UUID)
RETURNS TABLE (
  rc_item_id UUID, item_numero INT, descricao TEXT, quantidade NUMERIC,
  melhor_cotacao_id UUID, melhor_fornecedor_id UUID, fornecedor_nome TEXT,
  valor_unitario NUMERIC, valor_total NUMERIC, prazo_entrega_dias INT,
  conformidade TEXT, estrelas SMALLINT, total_ofertas INT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH itens_rc AS (
    SELECT i.id, i.item_numero, i.descricao, i.quantidade
    FROM public.purchase_requisition_items i
    WHERE i.requisition_id = _rc_id
  ),
  ranked AS (
    SELECT
      ci.rc_item_id, ci.cotacao_id, c.fornecedor_id,
      COALESCE(f.nome_fantasia, f.razao_social, c.fornecedor) AS fornecedor_nome,
      ci.valor_unitario, ci.valor_total, ci.prazo_entrega_dias,
      ci.conformidade, COALESCE(f.estrelas, 3)::SMALLINT AS estrelas,
      ROW_NUMBER() OVER (
        PARTITION BY ci.rc_item_id
        ORDER BY
          CASE ci.conformidade WHEN 'CONFORME' THEN 1 WHEN 'SIMILAR' THEN 2
                               WHEN 'DIVERGENTE' THEN 4 ELSE 3 END,
          ci.valor_unitario ASC,
          COALESCE(f.estrelas, 3) DESC,
          ci.prazo_entrega_dias ASC NULLS LAST
      ) AS rk,
      COUNT(*) OVER (PARTITION BY ci.rc_item_id) AS total_ofertas
    FROM public.rc_cotacao_itens ci
    JOIN public.rc_cotacoes c ON c.id = ci.cotacao_id
    LEFT JOIN public.fornecedores f ON f.id = c.fornecedor_id
    WHERE c.rc_id = _rc_id
      AND ci.conformidade <> 'NAO_COTADO'
      AND ci.valor_unitario > 0
      AND ci.rc_item_id IS NOT NULL
  )
  SELECT ir.id, ir.item_numero, ir.descricao, ir.quantidade,
    r.cotacao_id, r.fornecedor_id, r.fornecedor_nome,
    r.valor_unitario, r.valor_total, r.prazo_entrega_dias,
    r.conformidade, r.estrelas, COALESCE(r.total_ofertas::INT, 0)
  FROM itens_rc ir
  LEFT JOIN ranked r ON r.rc_item_id = ir.id AND r.rk = 1
  ORDER BY ir.item_numero NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.melhor_combo_por_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_cobertura_cotacao(UUID) TO authenticated;

-- 8) Backfill
DO $$
DECLARE c RECORD; rcs UUID[];
BEGIN
  FOR c IN SELECT id FROM public.rc_cotacoes LOOP
    PERFORM public.recalcular_cobertura_cotacao(c.id);
  END LOOP;
  SELECT ARRAY(SELECT DISTINCT rc_id FROM public.rc_cotacoes) INTO rcs;
  FOR c IN SELECT unnest(rcs) AS rc_id LOOP
    PERFORM public.calcular_scores_rc(c.rc_id);
  END LOOP;
END $$;

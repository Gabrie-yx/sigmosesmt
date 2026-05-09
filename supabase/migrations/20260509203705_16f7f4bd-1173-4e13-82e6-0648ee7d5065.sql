-- 1. Restrição: saldo nunca negativo
ALTER TABLE public.estoque_epi
  ADD CONSTRAINT estoque_epi_qtd_nao_negativa CHECK (quantidade_atual >= 0);

-- 2. Coluna de fornecedor
ALTER TABLE public.estoque_epi
  ADD COLUMN ultimo_fornecedor TEXT;

-- 3. Enum de tipo de movimentação
CREATE TYPE public.tipo_movimentacao_epi AS ENUM ('SAIDA_ENTREGA', 'ENTRADA_REPOSICAO', 'DEVOLUCAO');

-- 4. Coluna tipo_movimentacao no histórico
ALTER TABLE public.historico_entregas
  ADD COLUMN tipo_movimentacao public.tipo_movimentacao_epi NOT NULL DEFAULT 'SAIDA_ENTREGA';

CREATE INDEX idx_historico_entregas_tipo ON public.historico_entregas(tipo_movimentacao);

-- 5. Atualiza RPC de entrega para gravar o tipo
CREATE OR REPLACE FUNCTION public.registrar_entrega_epi(
  _epi_id UUID,
  _cpf TEXT,
  _nome TEXT,
  _qtd INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo INTEGER;
  v_id UUID;
  v_user UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR NOT is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para registrar entrega';
  END IF;
  IF _qtd IS NULL OR _qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT quantidade_atual INTO v_saldo FROM public.estoque_epi WHERE id = _epi_id FOR UPDATE;
  IF v_saldo IS NULL THEN
    RAISE EXCEPTION 'EPI não encontrado';
  END IF;
  IF v_saldo < _qtd THEN
    RAISE EXCEPTION 'Saldo insuficiente (atual: %)', v_saldo;
  END IF;

  UPDATE public.estoque_epi SET quantidade_atual = quantidade_atual - _qtd WHERE id = _epi_id;

  INSERT INTO public.historico_entregas
    (cpf_colaborador, nome_colaborador, epi_id, quantidade_entregue, created_by, tipo_movimentacao)
  VALUES (_cpf, _nome, _epi_id, _qtd, v_user, 'SAIDA_ENTREGA')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 6. RPC para entrada/devolução (soma no saldo)
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_epi(
  _epi_id UUID,
  _qtd INTEGER,
  _tipo public.tipo_movimentacao_epi,
  _cpf TEXT DEFAULT NULL,
  _nome TEXT DEFAULT NULL,
  _fornecedor TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_user UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR NOT is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _qtd IS NULL OR _qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  IF _tipo = 'SAIDA_ENTREGA' THEN
    RAISE EXCEPTION 'Use registrar_entrega_epi para saídas';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.estoque_epi WHERE id = _epi_id) THEN
    RAISE EXCEPTION 'EPI não encontrado';
  END IF;

  -- Entrada / devolução: soma no saldo
  UPDATE public.estoque_epi
     SET quantidade_atual = quantidade_atual + _qtd,
         ultimo_fornecedor = COALESCE(_fornecedor, ultimo_fornecedor)
   WHERE id = _epi_id;

  INSERT INTO public.historico_entregas
    (cpf_colaborador, nome_colaborador, epi_id, quantidade_entregue, created_by, tipo_movimentacao)
  VALUES (COALESCE(_cpf, ''), COALESCE(_nome, ''), _epi_id, _qtd, v_user, _tipo)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 7. Ajuste manual de saldo (somente admin)
CREATE OR REPLACE FUNCTION public.ajustar_saldo_epi(
  _epi_id UUID,
  _novo_saldo INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR NOT has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ajustar saldo';
  END IF;
  IF _novo_saldo < 0 THEN
    RAISE EXCEPTION 'Saldo não pode ser negativo';
  END IF;

  UPDATE public.estoque_epi SET quantidade_atual = _novo_saldo WHERE id = _epi_id;
END;
$$;
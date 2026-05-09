-- Tabela de estoque de EPIs
CREATE TABLE public.estoque_epi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_material TEXT NOT NULL,
  nome_material TEXT NOT NULL,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 5,
  imagem_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_epi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_epi_select" ON public.estoque_epi FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque_epi_insert" ON public.estoque_epi FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY "estoque_epi_update" ON public.estoque_epi FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY "estoque_epi_delete" ON public.estoque_epi FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_estoque_epi_updated_at
BEFORE UPDATE ON public.estoque_epi
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de histórico de entregas
CREATE TABLE public.historico_entregas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf_colaborador TEXT NOT NULL,
  nome_colaborador TEXT NOT NULL,
  epi_id UUID NOT NULL REFERENCES public.estoque_epi(id) ON DELETE RESTRICT,
  quantidade_entregue INTEGER NOT NULL CHECK (quantidade_entregue > 0),
  data_entrega TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.historico_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_entregas_select" ON public.historico_entregas FOR SELECT TO authenticated USING (true);
CREATE POLICY "historico_entregas_insert" ON public.historico_entregas FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY "historico_entregas_delete" ON public.historico_entregas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_historico_entregas_epi ON public.historico_entregas(epi_id);
CREATE INDEX idx_historico_entregas_data ON public.historico_entregas(data_entrega DESC);

-- Função transacional: dá baixa no estoque + grava histórico
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

  INSERT INTO public.historico_entregas (cpf_colaborador, nome_colaborador, epi_id, quantidade_entregue, created_by)
  VALUES (_cpf, _nome, _epi_id, _qtd, v_user)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
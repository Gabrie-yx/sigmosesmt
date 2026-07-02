
-- 1. Função helper: quem pode gerenciar cotações
CREATE OR REPLACE FUNCTION public.pode_gerenciar_compras(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'compras'::public.app_role)
    OR public.is_supervisor_geral(_user_id);
$$;

-- 2. Tabela
CREATE TABLE public.rc_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_id uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  cnpj text,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  arquivo_url text NOT NULL,
  arquivo_nome text,
  arquivo_tipo text,
  is_vencedora boolean NOT NULL DEFAULT false,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rc_cotacoes_rc ON public.rc_cotacoes(rc_id);
CREATE INDEX idx_rc_cotacoes_vencedora ON public.rc_cotacoes(rc_id) WHERE is_vencedora = true;

-- 3. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rc_cotacoes TO authenticated;
GRANT ALL ON public.rc_cotacoes TO service_role;

-- 4. RLS
ALTER TABLE public.rc_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_cotacoes_select_all_auth"
ON public.rc_cotacoes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "rc_cotacoes_insert_compras"
ON public.rc_cotacoes FOR INSERT
TO authenticated
WITH CHECK (public.pode_gerenciar_compras(auth.uid()));

CREATE POLICY "rc_cotacoes_update_compras"
ON public.rc_cotacoes FOR UPDATE
TO authenticated
USING (public.pode_gerenciar_compras(auth.uid()))
WITH CHECK (public.pode_gerenciar_compras(auth.uid()));

CREATE POLICY "rc_cotacoes_delete_compras"
ON public.rc_cotacoes FOR DELETE
TO authenticated
USING (public.pode_gerenciar_compras(auth.uid()));

-- 5. Trigger updated_at
CREATE TRIGGER trg_rc_cotacoes_updated
BEFORE UPDATE ON public.rc_cotacoes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Marcar vencedora (garante única)
CREATE OR REPLACE FUNCTION public.marcar_cotacao_vencedora(_cotacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rc uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_gerenciar_compras(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para marcar cotação vencedora';
  END IF;
  SELECT rc_id INTO v_rc FROM public.rc_cotacoes WHERE id = _cotacao_id;
  IF v_rc IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;

  UPDATE public.rc_cotacoes SET is_vencedora = false WHERE rc_id = v_rc AND id <> _cotacao_id;
  UPDATE public.rc_cotacoes SET is_vencedora = true  WHERE id = _cotacao_id;
END;
$$;

-- 7. Enviar RC pro Supervisor (exige 3 cotações + 1 vencedora)
CREATE OR REPLACE FUNCTION public.enviar_rc_para_supervisor(_rc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_qtd int;
  v_vencedora public.rc_cotacoes%ROWTYPE;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras pode enviar RC pro Supervisor';
  END IF;

  SELECT status INTO v_status FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status NOT IN ('PENDENTE','EM_COTACAO') THEN
    RAISE EXCEPTION 'RC não está mais em cotação (status: %)', v_status;
  END IF;

  SELECT count(*) INTO v_qtd FROM public.rc_cotacoes WHERE rc_id = _rc_id;
  IF v_qtd < 3 THEN
    RAISE EXCEPTION 'Anexe no mínimo 3 cotações (atual: %)', v_qtd;
  END IF;

  SELECT * INTO v_vencedora FROM public.rc_cotacoes WHERE rc_id = _rc_id AND is_vencedora = true LIMIT 1;
  IF v_vencedora.id IS NULL THEN
    RAISE EXCEPTION 'Marque a cotação vencedora antes de enviar';
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.purchase_requisitions
     SET status = 'COTADA',
         cotador_nome = COALESCE(v_nome, 'Compras'),
         cotacao_fornecedor = v_vencedora.fornecedor,
         cotacao_valor = v_vencedora.valor,
         cotacao_at = now(),
         cotacao_submitted_at = now()
   WHERE id = _rc_id;
END;
$$;

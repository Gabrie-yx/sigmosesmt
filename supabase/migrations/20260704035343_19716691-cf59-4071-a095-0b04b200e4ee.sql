-- Sprint 1 — Blindagem RC (numeração atômica, locks, RPCs de decisão/PC/NF)

-- 1) UNIQUE em numero (não há duplicados hoje)
ALTER TABLE public.purchase_requisitions
  ADD CONSTRAINT purchase_requisitions_numero_key UNIQUE (numero);

-- 2) Geração atômica de número (SEQ/MM/YYYY) usando advisory lock por mês+ano
CREATE OR REPLACE FUNCTION public.gerar_numero_rc(_data date DEFAULT current_date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mm text := to_char(_data, 'MM');
  v_yyyy text := to_char(_data, 'YYYY');
  v_start date := date_trunc('month', _data)::date;
  v_end date := (date_trunc('month', _data) + interval '1 month')::date;
  v_seq int;
  v_numero text;
  v_key bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;
  -- Lock por (ano*100+mês) para serializar geração no mesmo mês
  v_key := (EXTRACT(YEAR FROM _data)::bigint * 100) + EXTRACT(MONTH FROM _data)::bigint;
  PERFORM pg_advisory_xact_lock(hashtext('rc_numero'), v_key::int);

  SELECT COUNT(*) + 1 INTO v_seq
    FROM public.purchase_requisitions
   WHERE data_requisicao >= v_start AND data_requisicao < v_end;

  LOOP
    v_numero := lpad(v_seq::text, 3, '0') || '/' || v_mm || '/' || v_yyyy;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.purchase_requisitions WHERE numero = v_numero
    );
    v_seq := v_seq + 1;
  END LOOP;
  RETURN v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_numero_rc(date) TO authenticated;

-- 3) Pegar RC pra cotar (atômico, com FOR UPDATE)
CREATE OR REPLACE FUNCTION public.pegar_rc_para_cotar(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rc record;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras pode pegar RCs para cotar';
  END IF;

  SELECT id, status, pego_por_compras_nome INTO v_rc
    FROM public.purchase_requisitions
   WHERE status_token = _token
   FOR UPDATE;
  IF v_rc.id IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_rc.status = 'EM_COTACAO' THEN
    RAISE EXCEPTION 'Já está sendo cotada por %', COALESCE(v_rc.pego_por_compras_nome, 'outro comprador');
  END IF;
  IF v_rc.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Esta RC já saiu da fila (status: %)', v_rc.status;
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.purchase_requisitions
     SET status = 'EM_COTACAO',
         pego_por_compras_id = v_uid,
         pego_por_compras_nome = COALESCE(v_nome, 'Compras'),
         pego_em = now()
   WHERE id = v_rc.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pegar_rc_para_cotar(uuid) TO authenticated;

-- 4) Decidir RC — SOMENTE Supervisor Geral, com carimbo+assinatura
CREATE OR REPLACE FUNCTION public.decidir_rc(
  _rc_id uuid,
  _decisao text,
  _motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_nome text;
  v_sig text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_supervisor_geral(v_uid) THEN
    RAISE EXCEPTION 'Apenas o Supervisor Geral pode deferir ou indeferir RCs';
  END IF;
  IF _decisao NOT IN ('APROVADA','INDEFERIDA') THEN
    RAISE EXCEPTION 'Decisão inválida: %', _decisao;
  END IF;
  IF _decisao = 'INDEFERIDA' AND (_motivo IS NULL OR btrim(_motivo) = '') THEN
    RAISE EXCEPTION 'Informe o motivo do indeferimento';
  END IF;

  SELECT status INTO v_status
    FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status IN ('APROVADA','INDEFERIDA') THEN
    RAISE EXCEPTION 'Esta RC já foi decidida (status: %)', v_status;
  END IF;
  IF v_status NOT IN ('PENDENTE','COTADA') THEN
    RAISE EXCEPTION 'RC não está pronta para decisão (status: %)', v_status;
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;
  SELECT signature_data INTO v_sig
    FROM public.user_signatures
   WHERE user_id = v_uid
   ORDER BY is_default DESC, updated_at DESC
   LIMIT 1;

  UPDATE public.purchase_requisitions
     SET status = _decisao,
         motivo_indeferimento = CASE WHEN _decisao='INDEFERIDA' THEN btrim(_motivo) ELSE NULL END,
         approved_at = now(),
         approved_by = v_uid,
         decidido_por_id = v_uid,
         decidido_por_nome = v_nome,
         decidido_assinatura_url = v_sig,
         decidido_em = now()
   WHERE id = _rc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decidir_rc(uuid, text, text) TO authenticated;

-- 5) Emitir Pedido de Compra — só Compras, só após APROVADA
CREATE OR REPLACE FUNCTION public.emitir_pc_rc(
  _rc_id uuid,
  _pc_numero text,
  _fornecedor text,
  _valor numeric,
  _prazo date DEFAULT NULL,
  _arquivo_url text DEFAULT NULL,
  _arquivo_nome text DEFAULT NULL,
  _observacoes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras pode emitir Pedido de Compra';
  END IF;
  IF _pc_numero IS NULL OR btrim(_pc_numero) = '' THEN
    RAISE EXCEPTION 'Informe o número do PC';
  END IF;
  IF _fornecedor IS NULL OR btrim(_fornecedor) = '' THEN
    RAISE EXCEPTION 'Informe o fornecedor';
  END IF;
  IF _valor IS NULL OR _valor <= 0 THEN
    RAISE EXCEPTION 'Valor do PC inválido';
  END IF;

  SELECT status INTO v_status
    FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status <> 'APROVADA' THEN
    RAISE EXCEPTION 'RC precisa estar APROVADA para emitir PC (status: %)', v_status;
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.purchase_requisitions
     SET status = 'EM_RECEBIMENTO',
         pc_numero = btrim(_pc_numero),
         pc_fornecedor = btrim(_fornecedor),
         pc_valor = _valor,
         pc_prazo_entrega = _prazo,
         pc_arquivo_url = _arquivo_url,
         pc_arquivo_nome = _arquivo_nome,
         pc_observacoes = NULLIF(btrim(COALESCE(_observacoes,'')), ''),
         pc_emitido_por_id = v_uid,
         pc_emitido_por_nome = v_nome,
         pc_emitido_em = now()
   WHERE id = _rc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emitir_pc_rc(uuid, text, text, numeric, date, text, text, text) TO authenticated;

-- 6) Registrar Recebimento — só Compras, só após EM_RECEBIMENTO
CREATE OR REPLACE FUNCTION public.registrar_recebimento_rc(
  _rc_id uuid,
  _nf_numero text,
  _arquivo_url text DEFAULT NULL,
  _arquivo_nome text DEFAULT NULL,
  _observacoes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras pode registrar recebimento';
  END IF;
  IF _nf_numero IS NULL OR btrim(_nf_numero) = '' THEN
    RAISE EXCEPTION 'Informe o número da NF';
  END IF;

  SELECT status INTO v_status
    FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status <> 'EM_RECEBIMENTO' THEN
    RAISE EXCEPTION 'RC precisa estar EM_RECEBIMENTO (status: %)', v_status;
  END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.purchase_requisitions
     SET status = 'CONCLUIDA',
         nf_numero = btrim(_nf_numero),
         nf_arquivo_url = _arquivo_url,
         nf_arquivo_nome = _arquivo_nome,
         nf_observacoes = NULLIF(btrim(COALESCE(_observacoes,'')), ''),
         recebido_em = now(),
         recebido_por_id = v_uid,
         recebido_por_nome = v_nome
   WHERE id = _rc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_recebimento_rc(uuid, text, text, text, text) TO authenticated;

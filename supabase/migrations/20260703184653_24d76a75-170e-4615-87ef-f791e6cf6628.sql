
-- 1) Colunas novas em purchase_requisitions
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS retroativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retroativa_motivo text,
  ADD COLUMN IF NOT EXISTS arquivada_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivada_por uuid,
  ADD COLUMN IF NOT EXISTS arquivada_por_nome text,
  ADD COLUMN IF NOT EXISTS arquivamento_motivo text;

CREATE INDEX IF NOT EXISTS idx_pr_retroativa ON public.purchase_requisitions(retroativa) WHERE retroativa = true;
CREATE INDEX IF NOT EXISTS idx_pr_arquivada  ON public.purchase_requisitions(arquivada_em) WHERE arquivada_em IS NOT NULL;

-- 2) RPC: arquivar RC legada/retroativa (Compras/Admin)
CREATE OR REPLACE FUNCTION public.arquivar_rc(_rc_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_numero text;
  v_email text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras/Admin podem arquivar requisições';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo do arquivamento (mínimo 5 caracteres)';
  END IF;

  SELECT numero INTO v_numero FROM public.purchase_requisitions WHERE id = _rc_id;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  UPDATE public.purchase_requisitions
     SET arquivada_em = now(),
         arquivada_por = v_uid,
         arquivada_por_nome = COALESCE(v_nome, v_email, 'Compras'),
         arquivamento_motivo = btrim(_motivo)
   WHERE id = _rc_id;

  INSERT INTO public.audit_logs (table_name, action, record_id, user_id, user_email, new_data)
  VALUES ('purchase_requisitions', 'UPDATE', _rc_id, v_uid, v_email,
    jsonb_build_object('evento','RC_ARQUIVADA','numero',v_numero,'motivo',btrim(_motivo)));
END;
$$;

-- 3) RPC: desarquivar (caso Compras erre)
CREATE OR REPLACE FUNCTION public.desarquivar_rc(_rc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_numero text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras/Admin podem desarquivar';
  END IF;
  SELECT numero INTO v_numero FROM public.purchase_requisitions WHERE id = _rc_id;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  UPDATE public.purchase_requisitions
     SET arquivada_em = NULL,
         arquivada_por = NULL,
         arquivada_por_nome = NULL,
         arquivamento_motivo = NULL
   WHERE id = _rc_id;

  INSERT INTO public.audit_logs (table_name, action, record_id, user_id, user_email, new_data)
  VALUES ('purchase_requisitions', 'UPDATE', _rc_id, v_uid, v_email,
    jsonb_build_object('evento','RC_DESARQUIVADA','numero',v_numero));
END;
$$;

-- 4) Reabrir as 6 RCs legadas do SESMT como PENDENTE + marcar como retroativas
UPDATE public.purchase_requisitions
   SET status = 'PENDENTE',
       retroativa = true,
       retroativa_motivo = 'RC criada antes do fluxo de Compras existir; reaberta para cotação retroativa.',
       approved_at = NULL,
       approved_by = NULL,
       decidido_por_id = NULL,
       decidido_por_nome = NULL,
       decidido_assinatura_url = NULL,
       decidido_em = NULL,
       motivo_indeferimento = NULL
 WHERE status IN ('COTADA','APROVADA','INDEFERIDA')
   AND cotacao_at IS NULL
   AND cotador_nome IS NULL
   AND pego_por_compras_nome IS NULL
   AND dispensa_cotacao = false
   AND arquivada_em IS NULL;

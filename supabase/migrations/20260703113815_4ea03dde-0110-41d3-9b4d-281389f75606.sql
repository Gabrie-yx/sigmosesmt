
-- 1) Novos campos de dispensa
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS dispensa_cotacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispensa_motivo text,
  ADD COLUMN IF NOT EXISTS dispensa_justificativa text,
  ADD COLUMN IF NOT EXISTS dispensa_by uuid,
  ADD COLUMN IF NOT EXISTS dispensa_at timestamptz;

-- 2) RPC: dispensar cotações (Compras/Admin)
CREATE OR REPLACE FUNCTION public.dispensar_cotacoes_rc(
  _rc_id uuid,
  _motivo text,
  _justificativa text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_qtd int;
  v_motivos text[] := ARRAY[
    'FORNECEDOR_EXCLUSIVO',
    'CONTRATO_GUARDA_CHUVA',
    'URGENCIA_OPERACIONAL',
    'PADRONIZACAO_TECNICA',
    'OUTRO'
  ];
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras/Admin podem dispensar cotações';
  END IF;

  IF _motivo IS NULL OR NOT (_motivo = ANY(v_motivos)) THEN
    RAISE EXCEPTION 'Motivo de dispensa inválido';
  END IF;

  IF _justificativa IS NULL OR length(btrim(_justificativa)) < 30 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 30 caracteres)';
  END IF;

  SELECT status INTO v_status FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status NOT IN ('PENDENTE','EM_COTACAO') THEN
    RAISE EXCEPTION 'RC não está mais em cotação (status: %)', v_status;
  END IF;

  SELECT count(*) INTO v_qtd FROM public.rc_cotacoes WHERE rc_id = _rc_id;
  IF v_qtd < 1 THEN
    RAISE EXCEPTION 'Anexe ao menos 1 cotação do fornecedor dispensado antes de marcar dispensa';
  END IF;

  UPDATE public.purchase_requisitions
     SET dispensa_cotacao      = true,
         dispensa_motivo       = _motivo,
         dispensa_justificativa= btrim(_justificativa),
         dispensa_by           = v_uid,
         dispensa_at           = now()
   WHERE id = _rc_id;

  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, details)
  VALUES (v_uid, 'RC_DISPENSA_COTACAO', 'purchase_requisitions', _rc_id,
    jsonb_build_object('motivo', _motivo, 'justificativa', btrim(_justificativa)));
END;
$$;

-- 3) RPC: revogar dispensa (usada pelo Compras antes do envio)
CREATE OR REPLACE FUNCTION public.revogar_dispensa_rc(_rc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras/Admin podem revogar dispensa';
  END IF;

  SELECT status INTO v_status FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status NOT IN ('PENDENTE','EM_COTACAO') THEN
    RAISE EXCEPTION 'RC já não está em cotação';
  END IF;

  UPDATE public.purchase_requisitions
     SET dispensa_cotacao=false,
         dispensa_motivo=null,
         dispensa_justificativa=null,
         dispensa_by=null,
         dispensa_at=null
   WHERE id = _rc_id;

  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, details)
  VALUES (v_uid, 'RC_DISPENSA_REVOGADA', 'purchase_requisitions', _rc_id, '{}'::jsonb);
END;
$$;

-- 4) Substitui enviar_rc_para_supervisor: aceita dispensa (>=1 cotação + vencedora) OU regra normal (>=3 + vencedora)
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
  v_min int;
  v_dispensa boolean;
  v_vencedora public.rc_cotacoes%ROWTYPE;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerenciar_compras(v_uid) THEN
    RAISE EXCEPTION 'Apenas Compras pode enviar RC pro Supervisor';
  END IF;

  SELECT status, COALESCE(dispensa_cotacao,false)
    INTO v_status, v_dispensa
    FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status NOT IN ('PENDENTE','EM_COTACAO') THEN
    RAISE EXCEPTION 'RC não está mais em cotação (status: %)', v_status;
  END IF;

  v_min := CASE WHEN v_dispensa THEN 1 ELSE 3 END;

  SELECT count(*) INTO v_qtd FROM public.rc_cotacoes WHERE rc_id = _rc_id;
  IF v_qtd < v_min THEN
    IF v_dispensa THEN
      RAISE EXCEPTION 'RC dispensada exige ao menos 1 cotação anexada';
    ELSE
      RAISE EXCEPTION 'Anexe no mínimo 3 cotações (atual: %) ou marque dispensa de cotação', v_qtd;
    END IF;
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

-- 5) RPC: Supervisor devolve RC (dispensada ou não) pedindo cotações completas
CREATE OR REPLACE FUNCTION public.devolver_rc_para_cotacao(_rc_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_sup boolean;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  -- Supervisor Geral ou admin
  SELECT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'supervisor_geral'))
    INTO v_is_sup;
  IF NOT v_is_sup THEN
    RAISE EXCEPTION 'Apenas Supervisor Geral pode devolver a RC';
  END IF;

  IF _motivo IS NULL OR length(btrim(_motivo)) < 10 THEN
    RAISE EXCEPTION 'Informe o motivo da devolução (mínimo 10 caracteres)';
  END IF;

  SELECT status INTO v_status FROM public.purchase_requisitions WHERE id = _rc_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status <> 'COTADA' THEN
    RAISE EXCEPTION 'Só é possível devolver RCs no status COTADA';
  END IF;

  UPDATE public.purchase_requisitions
     SET status = 'EM_COTACAO',
         dispensa_cotacao = false,
         dispensa_motivo = null,
         dispensa_justificativa = null,
         dispensa_by = null,
         dispensa_at = null,
         cotacao_fornecedor = null,
         cotacao_valor = null,
         cotacao_at = null
   WHERE id = _rc_id;

  INSERT INTO public.audit_logs(user_id, action, entity, entity_id, details)
  VALUES (v_uid, 'RC_DEVOLVIDA_PARA_COTACAO', 'purchase_requisitions', _rc_id,
    jsonb_build_object('motivo', btrim(_motivo)));
END;
$$;

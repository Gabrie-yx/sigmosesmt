CREATE OR REPLACE FUNCTION public.decidir_rc(_rc_id uuid, _decisao text, _motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT status::text INTO v_status
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
     SET status = _decisao::purchase_req_status,
         motivo_indeferimento = CASE WHEN _decisao='INDEFERIDA' THEN btrim(_motivo) ELSE NULL END,
         approved_at = now(),
         approved_by = v_uid,
         decidido_por_id = v_uid,
         decidido_por_nome = v_nome,
         decidido_assinatura_url = v_sig,
         decidido_em = now(),
         status_token_expires_at = now()
   WHERE id = _rc_id;
END;
$function$;
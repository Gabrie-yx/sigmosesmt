
UPDATE public.purchase_requisitions
SET status = 'COTADA',
    approved_at = NULL,
    approved_by = NULL,
    decidido_por_id = NULL,
    decidido_por_nome = NULL,
    decidido_assinatura_url = NULL,
    decidido_em = NULL,
    motivo_indeferimento = NULL
WHERE id = '331d2d15-ad33-4aa5-9bb8-a9f91d94dbc2';

INSERT INTO public.audit_logs (table_name, action, record_id, new_data)
VALUES (
  'purchase_requisitions',
  'UPDATE',
  '331d2d15-ad33-4aa5-9bb8-a9f91d94dbc2',
  jsonb_build_object(
    'evento', 'RC_REABERTA',
    'numero', '002/06/2026',
    'de', 'APROVADA',
    'para', 'COTADA',
    'motivo', 'Reversão manual — deferimento acidental',
    'origem', 'migration'
  )
);

CREATE OR REPLACE FUNCTION public.reabrir_rc(_rc_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_sup boolean;
  v_is_admin boolean;
  v_status text;
  v_numero text;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Informe uma justificativa (mínimo 5 caracteres)';
  END IF;

  SELECT public.is_supervisor_geral(v_uid) INTO v_is_sup;
  SELECT public.has_role(v_uid, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT (COALESCE(v_is_sup, false) OR COALESCE(v_is_admin, false)) THEN
    RAISE EXCEPTION 'Apenas Supervisor Geral ou administrador podem reabrir requisições';
  END IF;

  SELECT status, numero INTO v_status, v_numero
  FROM public.purchase_requisitions WHERE id = _rc_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RC não encontrada'; END IF;
  IF v_status NOT IN ('APROVADA', 'INDEFERIDA') THEN
    RAISE EXCEPTION 'Só é possível reabrir RC já decidida (atual: %)', v_status;
  END IF;

  UPDATE public.purchase_requisitions
  SET status = 'COTADA',
      approved_at = NULL, approved_by = NULL,
      decidido_por_id = NULL, decidido_por_nome = NULL,
      decidido_assinatura_url = NULL, decidido_em = NULL,
      motivo_indeferimento = NULL
  WHERE id = _rc_id;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.audit_logs (table_name, action, record_id, user_id, user_email, new_data)
  VALUES (
    'purchase_requisitions', 'UPDATE', _rc_id, v_uid, v_email,
    jsonb_build_object(
      'evento', 'RC_REABERTA',
      'numero', v_numero,
      'de', v_status,
      'para', 'COTADA',
      'motivo', _motivo
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reabrir_rc(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reabrir_rc(uuid, text) TO authenticated;

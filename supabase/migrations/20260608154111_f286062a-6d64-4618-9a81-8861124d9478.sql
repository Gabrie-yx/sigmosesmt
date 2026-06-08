CREATE OR REPLACE FUNCTION public.atestado_sync_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_override_id UUID;
  v_user UUID;
  v_email TEXT;
BEGIN
  IF NEW.status = 'HOMOLOGADO' AND NEW.dias_afastamento > 0
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'HOMOLOGADO') THEN
    v_user := COALESCE(NEW.homologado_por, NEW.created_by, auth.uid());
    IF v_user IS NOT NULL THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user;
    END IF;

    INSERT INTO public.safety_overrides (
      employee_id, scope, item_key, justificativa,
      liberado_por, liberado_por_email, liberado_em, expira_em, ativo
    )
    VALUES (
      NEW.employee_id, 'GLOBAL', NULL,
      'Afastamento médico — atestado homologado (' || COALESCE(NEW.cid,'sem CID')
        || ', ' || NEW.dias_afastamento || ' dias). BLOQUEIO de entrada na portaria até ' ||
        to_char(COALESCE(NEW.data_retorno, NEW.data_inicio + NEW.dias_afastamento), 'DD/MM/YYYY') || '.',
      v_user, v_email, now(),
      (COALESCE(NEW.data_retorno, NEW.data_inicio + NEW.dias_afastamento) + INTERVAL '1 day')::timestamptz,
      true
    )
    RETURNING id INTO v_override_id;
    NEW.override_id := v_override_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'HOMOLOGADO' AND NEW.status <> 'HOMOLOGADO' AND OLD.override_id IS NOT NULL THEN
    UPDATE public.safety_overrides
       SET ativo = false,
           revogado_em = now(),
           revogado_por = COALESCE(auth.uid(), NEW.created_by),
           motivo_revogacao = 'Atestado deixou de ser homologado'
     WHERE id = OLD.override_id;
  END IF;

  RETURN NEW;
END;
$function$;
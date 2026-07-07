-- C-10: Desligamento convoca ASO DEMISSIONAL automaticamente
CREATE OR REPLACE FUNCTION public.fechar_pendencias_ao_desligar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_convs_canceladas INT := 0;
  v_overrides_revogados INT := 0;
  v_portaria_bloqueadas INT := 0;
  v_cpf_norm TEXT;
  v_convocacao_demissional_id uuid;
BEGIN
  -- só dispara quando data_desligamento passa de NULL para algo
  IF NEW.data_desligamento IS NULL OR OLD.data_desligamento IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) cancela convocações de exames pendentes (exceto DEMISSIONAL, que a gente
  --    vai criar no próximo passo — não faz sentido cancelar demissional pré-existente)
  WITH upd AS (
    UPDATE public.convocacoes_exames
       SET status = 'CANCELADA',
           observacoes = COALESCE(observacoes || E'\n', '')
                       || 'Cancelada automaticamente por desligamento em '
                       || to_char(NEW.data_desligamento, 'DD/MM/YYYY'),
           updated_at = now()
     WHERE employee_id = NEW.id
       AND status = 'PENDENTE'
       AND janela <> 'DEMISSIONAL'
    RETURNING 1
  )
  SELECT count(*) INTO v_convs_canceladas FROM upd;

  -- 2) revoga safety_overrides ativos
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='safety_overrides' AND column_name='revoked_at'
  ) THEN
    EXECUTE format($f$
      WITH upd AS (
        UPDATE public.safety_overrides
           SET revoked_at = now(),
               revoked_reason = 'Desligamento em ' || to_char(%L::date, 'DD/MM/YYYY')
         WHERE employee_id = %L
           AND revoked_at IS NULL
        RETURNING 1
      )
      SELECT count(*) FROM upd
    $f$, NEW.data_desligamento, NEW.id) INTO v_overrides_revogados;
  END IF;

  -- 3) bloqueia entrada na portaria (match por CPF normalizado)
  v_cpf_norm := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
  IF length(v_cpf_norm) = 11 THEN
    WITH upd AS (
      UPDATE public.portaria_pessoas
         SET bloqueado = true,
             motivo_bloqueio = 'Desligado em ' || to_char(NEW.data_desligamento, 'DD/MM/YYYY')
                            || COALESCE(' — ' || NEW.nome, ''),
             updated_at = now()
       WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_cpf_norm
         AND bloqueado = false
      RETURNING 1
    )
    SELECT count(*) INTO v_portaria_bloqueadas FROM upd;
  END IF;

  -- 4) C-10: convoca ASO DEMISSIONAL (idempotente)
  IF NOT EXISTS (
    SELECT 1 FROM public.convocacoes_exames
     WHERE employee_id = NEW.id
       AND status = 'PENDENTE'
       AND janela = 'DEMISSIONAL'
  ) THEN
    INSERT INTO public.convocacoes_exames (
      employee_id, janela, tipos_exame,
      convocado_por, data_limite, status, observacoes
    ) VALUES (
      NEW.id,
      'DEMISSIONAL',
      ARRAY['Exame Médico Demissional'],
      NEW.desligado_por,
      NEW.data_desligamento,
      'PENDENTE',
      'Convocação automática — desligamento em '
        || to_char(NEW.data_desligamento, 'DD/MM/YYYY')
        || '. NR-07 7.5.1.V exige exame demissional em até 10 dias contados do término do contrato.'
    ) RETURNING id INTO v_convocacao_demissional_id;
  END IF;

  -- 5) log de auditoria
  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
      NEW.desligado_por,
      'desligamento_cascata',
      'employees',
      NEW.id,
      jsonb_build_object(
        'data_desligamento', NEW.data_desligamento,
        'convocacoes_canceladas', v_convs_canceladas,
        'overrides_revogados', v_overrides_revogados,
        'portaria_bloqueadas', v_portaria_bloqueadas,
        'convocacao_demissional_id', v_convocacao_demissional_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;
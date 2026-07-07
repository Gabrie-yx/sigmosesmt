-- Onda 2 · Item 1 — Demissão fecha pendências em cascata
-- Trigger AFTER UPDATE em employees: quando data_desligamento passa de NULL → preenchido,
-- cancela convocações pendentes e revoga overrides ativos.

CREATE OR REPLACE FUNCTION public.fechar_pendencias_ao_desligar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convs_canceladas INT := 0;
  v_overrides_revogados INT := 0;
BEGIN
  -- só dispara quando data_desligamento passa de NULL para algo
  IF NEW.data_desligamento IS NULL OR OLD.data_desligamento IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) cancela convocações de exames pendentes
  WITH upd AS (
    UPDATE public.convocacoes_exames
       SET status = 'CANCELADA',
           observacoes = COALESCE(observacoes || E'\n', '')
                       || 'Cancelada automaticamente por desligamento em '
                       || to_char(NEW.data_desligamento, 'DD/MM/YYYY'),
           updated_at = now()
     WHERE employee_id = NEW.id
       AND status = 'PENDENTE'
    RETURNING 1
  )
  SELECT count(*) INTO v_convs_canceladas FROM upd;

  -- 2) revoga safety_overrides ativos (só se existirem colunas revoked_at/revoked_reason)
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

  -- 3) log de auditoria
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
        'overrides_revogados', v_overrides_revogados
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- se audit_logs tiver schema diferente, não bloqueia o desligamento
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fechar_pendencias_ao_desligar ON public.employees;
CREATE TRIGGER trg_fechar_pendencias_ao_desligar
AFTER UPDATE OF data_desligamento ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.fechar_pendencias_ao_desligar();

REVOKE EXECUTE ON FUNCTION public.fechar_pendencias_ao_desligar() FROM anon, authenticated;
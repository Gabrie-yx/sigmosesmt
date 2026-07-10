-- ============================================================
-- Onda 3 · Pacote C-11 + C-12 + C-13 (PET NR-33 blindado)
-- ============================================================

-- 1) Flag de modo strict por empresa (default OFF pra não quebrar operação)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS pet_modo_strict boolean NOT NULL DEFAULT false;

-- 2) Plano de resgate estruturado (NR-33 33.3.2.h)
ALTER TABLE public.ptes
  ADD COLUMN IF NOT EXISTS plano_resgate jsonb;

COMMENT ON COLUMN public.ptes.plano_resgate IS
  'NR-33 33.3.2.h — Plano de resgate estruturado. Sub-chaves esperadas: equipe_resgate, equipamentos, hospital_referencia, tempo_resposta_min, meio_comunicacao.';

-- 3) Soft delete em medições atmosféricas (impede sumiço de prova)
ALTER TABLE public.pte_medicoes_atmosfericas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

CREATE INDEX IF NOT EXISTS idx_pte_medicoes_ativas
  ON public.pte_medicoes_atmosfericas (pte_id, momento, medido_em DESC)
  WHERE deleted_at IS NULL;

-- ============================================================
-- Helper: retorna alertas de conformidade de uma PET
-- Usado no front pra badges no histórico + card do Hoje
-- ============================================================
CREATE OR REPLACE FUNCTION public.pet_status_alerta(_pte_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pte record;
  v_tem_entrada boolean;
  v_ultima_fora boolean;
  v_plano_ok boolean;
BEGIN
  SELECT id, tipo_pt, status, plano_resgate
    INTO v_pte
    FROM public.ptes
   WHERE id = _pte_id;

  IF NOT FOUND OR v_pte.tipo_pt <> 'PET' THEN
    RETURN jsonb_build_object('aplicavel', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pte_medicoes_atmosfericas
     WHERE pte_id = _pte_id
       AND momento = 'ENTRADA'
       AND deleted_at IS NULL
       AND tem_fora_limite = false
  ) INTO v_tem_entrada;

  SELECT COALESCE((
    SELECT tem_fora_limite
      FROM public.pte_medicoes_atmosfericas
     WHERE pte_id = _pte_id
       AND deleted_at IS NULL
     ORDER BY medido_em DESC
     LIMIT 1
  ), false) INTO v_ultima_fora;

  v_plano_ok := v_pte.plano_resgate IS NOT NULL
    AND jsonb_typeof(v_pte.plano_resgate) = 'object'
    AND coalesce(nullif(trim(v_pte.plano_resgate->>'equipe_resgate'), ''), '') <> ''
    AND coalesce(nullif(trim(v_pte.plano_resgate->>'equipamentos'), ''), '') <> ''
    AND coalesce(nullif(trim(v_pte.plano_resgate->>'hospital_referencia'), ''), '') <> ''
    AND (v_pte.plano_resgate->>'tempo_resposta_min') ~ '^[0-9]+$';

  RETURN jsonb_build_object(
    'aplicavel', true,
    'status_pte', v_pte.status,
    'needs_medicao_entrada', NOT v_tem_entrada,
    'atmosfera_alerta', v_ultima_fora,
    'needs_plano_resgate', NOT v_plano_ok
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pet_status_alerta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pet_status_alerta(uuid) TO authenticated;

-- ============================================================
-- Trigger 1: valida PET em modo strict (bloqueia INSERT/UPDATE inseguro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_validar_pet_strict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_strict boolean;
  v_alerta jsonb;
BEGIN
  IF NEW.tipo_pt <> 'PET' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pet_modo_strict, false)
    INTO v_strict
    FROM public.company_settings
    LIMIT 1;

  IF NOT v_strict THEN
    RETURN NEW;
  END IF;

  -- Em modo strict, PET só pode ir pra ATIVA se plano_resgate estruturado
  IF NEW.status = 'ATIVA' THEN
    IF NEW.plano_resgate IS NULL
       OR jsonb_typeof(NEW.plano_resgate) <> 'object'
       OR coalesce(nullif(trim(NEW.plano_resgate->>'equipe_resgate'), ''), '') = ''
       OR coalesce(nullif(trim(NEW.plano_resgate->>'equipamentos'), ''), '') = ''
       OR coalesce(nullif(trim(NEW.plano_resgate->>'hospital_referencia'), ''), '') = ''
       OR (NEW.plano_resgate->>'tempo_resposta_min') !~ '^[0-9]+$'
    THEN
      RAISE EXCEPTION 'PET-STRICT: plano de resgate obrigatório e completo (NR-33 33.3.2.h). Preencha equipe_resgate, equipamentos, hospital_referencia e tempo_resposta_min.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Ao atualizar pra ATIVA, exige medição de entrada conforme já registrada
    IF TG_OP = 'UPDATE' AND OLD.status <> 'ATIVA' THEN
      v_alerta := public.pet_status_alerta(NEW.id);
      IF (v_alerta->>'needs_medicao_entrada')::boolean THEN
        RAISE EXCEPTION 'PET-STRICT: medição atmosférica de ENTRADA conforme é obrigatória antes de ativar (NR-33 33.3.3).'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_pet_strict ON public.ptes;
CREATE TRIGGER trg_validar_pet_strict
  BEFORE INSERT OR UPDATE OF status, plano_resgate, tipo_pt
  ON public.ptes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_validar_pet_strict();

-- ============================================================
-- Trigger 2: reage a novas medições
--   - Em modo strict, fora-do-limite força PET pra SUSPENSA
--   - Em modo relax, só registra (front mostra badge via pet_status_alerta)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_medicao_reage_pet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_strict boolean;
  v_pte record;
BEGIN
  SELECT id, tipo_pt, status
    INTO v_pte
    FROM public.ptes
   WHERE id = NEW.pte_id;

  IF NOT FOUND OR v_pte.tipo_pt <> 'PET' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pet_modo_strict, false)
    INTO v_strict
    FROM public.company_settings
    LIMIT 1;

  IF NOT v_strict THEN
    RETURN NEW;
  END IF;

  -- Em strict: fora do limite suspende PET ativa
  IF NEW.tem_fora_limite = true AND v_pte.status = 'ATIVA' THEN
    UPDATE public.ptes
       SET status = 'SUSPENSA',
           updated_at = now()
     WHERE id = NEW.pte_id;

    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (
      auth.uid(),
      'pet_suspensa_atmosfera',
      'ptes',
      NEW.pte_id,
      jsonb_build_object(
        'medicao_id', NEW.id,
        'momento', NEW.momento,
        'motivo', 'Atmosfera fora do limite NR-33'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicao_reage_pet ON public.pte_medicoes_atmosfericas;
CREATE TRIGGER trg_medicao_reage_pet
  AFTER INSERT ON public.pte_medicoes_atmosfericas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_medicao_reage_pet();

-- ============================================================
-- Trigger 3: bloqueia DELETE físico de medição (soft delete only)
-- Prova documental blindada contra "sumir com medição ruim"
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_bloquear_delete_medicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'DELETE físico proibido em pte_medicoes_atmosfericas. Use soft delete: UPDATE ... SET deleted_at=now(), deleted_by=auth.uid(), deleted_motivo=...'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_delete_medicao ON public.pte_medicoes_atmosfericas;
CREATE TRIGGER trg_bloquear_delete_medicao
  BEFORE DELETE ON public.pte_medicoes_atmosfericas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_bloquear_delete_medicao();

-- ============================================================
-- Helper: soft delete de medição (registra quem e por quê)
-- ============================================================
CREATE OR REPLACE FUNCTION public.medicao_soft_delete(_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 10 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 10 caracteres) para soft delete de medição.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.pte_medicoes_atmosfericas
     SET deleted_at = now(),
         deleted_by = auth.uid(),
         deleted_motivo = _motivo,
         updated_at = now()
   WHERE id = _id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medição não encontrada ou já removida.';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'medicao_soft_delete',
    'pte_medicoes_atmosfericas',
    _id,
    jsonb_build_object('motivo', _motivo)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.medicao_soft_delete(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medicao_soft_delete(uuid, text) TO authenticated;
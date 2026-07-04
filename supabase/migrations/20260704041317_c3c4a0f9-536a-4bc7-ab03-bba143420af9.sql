-- Sprint 3: Urgência + SLA + obra obrigatória

-- 1) Enum de urgência
DO $$ BEGIN
  CREATE TYPE public.rc_urgencia AS ENUM ('NORMAL','URGENTE','EMERGENCIA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Colunas na RC
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS urgencia public.rc_urgencia NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;

-- 3) Helper: horas de SLA por nível
CREATE OR REPLACE FUNCTION public.rc_sla_horas(_urg public.rc_urgencia)
RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _urg
    WHEN 'EMERGENCIA' THEN 24
    WHEN 'URGENTE'    THEN 48
    ELSE 168  -- 7 dias
  END;
$$;

-- 4) Trigger: define sla_deadline sempre que criar ou mudar urgência
CREATE OR REPLACE FUNCTION public.tg_rc_set_sla_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base TIMESTAMPTZ;
BEGIN
  v_base := COALESCE(NEW.created_at, now());
  IF TG_OP = 'INSERT' OR NEW.urgencia IS DISTINCT FROM OLD.urgencia THEN
    NEW.sla_deadline := v_base + (public.rc_sla_horas(NEW.urgencia) || ' hours')::interval;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rc_sla_deadline ON public.purchase_requisitions;
CREATE TRIGGER trg_rc_sla_deadline
BEFORE INSERT OR UPDATE OF urgencia ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_rc_set_sla_deadline();

-- Backfill: linhas antigas ganham sla_deadline coerente
UPDATE public.purchase_requisitions
   SET sla_deadline = COALESCE(created_at, now()) + (public.rc_sla_horas(urgencia) || ' hours')::interval
 WHERE sla_deadline IS NULL;

-- 5) Trigger: obra obrigatória (construção OU manutenção)
CREATE OR REPLACE FUNCTION public.tg_rc_valida_obra()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(btrim(NEW.obra_construcao), '') = ''
     AND COALESCE(btrim(NEW.obra_manutencao), '') = '' THEN
    RAISE EXCEPTION 'Informe a obra (Construção ou Manutenção) da requisição';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_rc_valida_obra ON public.purchase_requisitions;
CREATE TRIGGER trg_rc_valida_obra
BEFORE INSERT ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_rc_valida_obra();

-- 6) Índices para ordenação/monitor de SLA
CREATE INDEX IF NOT EXISTS purchase_requisitions_sla_idx
  ON public.purchase_requisitions (sla_deadline)
  WHERE status IN ('PENDENTE','EM_COTACAO','COTADA');

CREATE INDEX IF NOT EXISTS purchase_requisitions_urgencia_idx
  ON public.purchase_requisitions (urgencia, data_requisicao DESC);

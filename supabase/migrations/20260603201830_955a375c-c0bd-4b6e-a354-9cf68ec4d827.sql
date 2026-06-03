
-- =========================================================
-- ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.tipo_acidente AS ENUM (
    'COM_AFASTAMENTO',
    'SEM_AFASTAMENTO',
    'TRAJETO',
    'FATAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.turno_acidente AS ENUM ('MANHA','TARDE','NOITE','MADRUGADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TABELA: acidentes_trabalho (FOR-SEG 09)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.acidentes_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cat TEXT,
  data_acidente DATE NOT NULL,
  hora_acidente TIME,
  turno public.turno_acidente,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  -- Vítima
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  vitima_nome TEXT NOT NULL,
  vitima_matricula TEXT,
  vitima_cargo TEXT,
  vitima_setor TEXT,
  -- Classificação
  tipo public.tipo_acidente NOT NULL DEFAULT 'SEM_AFASTAMENTO',
  dias_perdidos INT NOT NULL DEFAULT 0,
  dias_debitados INT NOT NULL DEFAULT 0,  -- conforme tabela NBR 14280 (morte/invalidez)
  -- Descrição
  local_acidente TEXT,
  descricao TEXT NOT NULL,
  agente_causador TEXT,
  parte_corpo_atingida TEXT,
  natureza_lesao TEXT,
  cid TEXT,
  -- Investigação
  causa_imediata TEXT,
  causa_basica TEXT,
  testemunhas TEXT,
  investigado BOOLEAN NOT NULL DEFAULT false,
  data_retorno DATE,
  observacoes TEXT,
  -- Metadados
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acidentes_data ON public.acidentes_trabalho(data_acidente DESC);
CREATE INDEX IF NOT EXISTS idx_acidentes_company ON public.acidentes_trabalho(company_id);
CREATE INDEX IF NOT EXISTS idx_acidentes_tipo ON public.acidentes_trabalho(tipo);
CREATE INDEX IF NOT EXISTS idx_acidentes_employee ON public.acidentes_trabalho(employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acidentes_trabalho TO authenticated;
GRANT ALL ON public.acidentes_trabalho TO service_role;

ALTER TABLE public.acidentes_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewer+ podem ver acidentes"
  ON public.acidentes_trabalho FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editor+ podem criar acidentes"
  ON public.acidentes_trabalho FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Editor+ podem atualizar acidentes"
  ON public.acidentes_trabalho FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Moderador+ podem excluir acidentes"
  ON public.acidentes_trabalho FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

CREATE TRIGGER trg_acidentes_updated_at
  BEFORE UPDATE ON public.acidentes_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- TABELA: hht_mensal
-- =========================================================
CREATE TABLE IF NOT EXISTS public.hht_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ano INT NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  hht NUMERIC(12,2) NOT NULL DEFAULT 0,
  empregados_medio INT NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_hht_periodo ON public.hht_mensal(ano DESC, mes DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hht_mensal TO authenticated;
GRANT ALL ON public.hht_mensal TO service_role;

ALTER TABLE public.hht_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewer+ podem ver HHT"
  ON public.hht_mensal FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editor+ podem gerenciar HHT"
  ON public.hht_mensal FOR ALL TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE TRIGGER trg_hht_updated_at
  BEFORE UPDATE ON public.hht_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- TABELA: dias_sem_acidente_recordes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dias_sem_acidente_recordes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  escopo TEXT NOT NULL DEFAULT 'COM_AFASTAMENTO', -- COM_AFASTAMENTO | REGISTRAVEL
  recorde_dias INT NOT NULL DEFAULT 0,
  data_inicio DATE,
  data_recorde DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, escopo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dias_sem_acidente_recordes TO authenticated;
GRANT ALL ON public.dias_sem_acidente_recordes TO service_role;

ALTER TABLE public.dias_sem_acidente_recordes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewer+ podem ver recordes"
  ON public.dias_sem_acidente_recordes FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Moderador+ podem gerenciar recordes"
  ON public.dias_sem_acidente_recordes FOR ALL TO authenticated
  USING (public.is_moderator(auth.uid()))
  WITH CHECK (public.is_moderator(auth.uid()));

CREATE TRIGGER trg_recordes_updated_at
  BEFORE UPDATE ON public.dias_sem_acidente_recordes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- VIEW: quadro estatístico (FOR-SEG 09) com TF, TG, TFsa
-- =========================================================
CREATE OR REPLACE VIEW public.vw_quadro_estatistico AS
WITH base AS (
  SELECT
    h.company_id,
    h.ano,
    h.mes,
    h.hht,
    h.empregados_medio,
    COALESCE((
      SELECT COUNT(*) FROM public.acidentes_trabalho a
      WHERE a.company_id = h.company_id
        AND EXTRACT(YEAR FROM a.data_acidente)::int = h.ano
        AND EXTRACT(MONTH FROM a.data_acidente)::int = h.mes
        AND a.tipo = 'COM_AFASTAMENTO'
    ),0) AS acid_com_afast,
    COALESCE((
      SELECT COUNT(*) FROM public.acidentes_trabalho a
      WHERE a.company_id = h.company_id
        AND EXTRACT(YEAR FROM a.data_acidente)::int = h.ano
        AND EXTRACT(MONTH FROM a.data_acidente)::int = h.mes
        AND a.tipo = 'SEM_AFASTAMENTO'
    ),0) AS acid_sem_afast,
    COALESCE((
      SELECT COUNT(*) FROM public.acidentes_trabalho a
      WHERE a.company_id = h.company_id
        AND EXTRACT(YEAR FROM a.data_acidente)::int = h.ano
        AND EXTRACT(MONTH FROM a.data_acidente)::int = h.mes
        AND a.tipo = 'FATAL'
    ),0) AS acid_fatais,
    COALESCE((
      SELECT SUM(a.dias_perdidos + a.dias_debitados) FROM public.acidentes_trabalho a
      WHERE a.company_id = h.company_id
        AND EXTRACT(YEAR FROM a.data_acidente)::int = h.ano
        AND EXTRACT(MONTH FROM a.data_acidente)::int = h.mes
    ),0) AS total_dias
  FROM public.hht_mensal h
)
SELECT
  b.*,
  CASE WHEN b.hht > 0
    THEN ROUND((b.acid_com_afast::numeric * 1000000) / b.hht, 2)
    ELSE 0 END AS taxa_frequencia,
  CASE WHEN b.hht > 0
    THEN ROUND((b.acid_sem_afast::numeric * 1000000) / b.hht, 2)
    ELSE 0 END AS taxa_frequencia_sa,
  CASE WHEN b.hht > 0
    THEN ROUND((b.total_dias::numeric * 1000000) / b.hht, 2)
    ELSE 0 END AS taxa_gravidade
FROM base b;

GRANT SELECT ON public.vw_quadro_estatistico TO authenticated;

-- =========================================================
-- FUNÇÃO: dias sem acidente (atual + recorde)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_dias_sem_acidente(_company_id UUID DEFAULT NULL)
RETURNS TABLE (
  company_id UUID,
  dias_sem_com_afast INT,
  dias_sem_registravel INT,
  ultimo_acidente_com_afast DATE,
  ultimo_acidente_registravel DATE,
  recorde_com_afast INT,
  recorde_registravel INT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH alvo AS (
    SELECT DISTINCT c.id AS cid
    FROM public.companies c
    WHERE _company_id IS NULL OR c.id = _company_id
  ),
  ult AS (
    SELECT
      a.cid,
      (SELECT MAX(at.data_acidente) FROM public.acidentes_trabalho at
        WHERE at.company_id = a.cid AND at.tipo IN ('COM_AFASTAMENTO','FATAL')) AS u_caf,
      (SELECT MAX(at.data_acidente) FROM public.acidentes_trabalho at
        WHERE at.company_id = a.cid) AS u_reg
    FROM alvo a
  )
  SELECT
    u.cid,
    CASE WHEN u.u_caf IS NULL THEN NULL ELSE (CURRENT_DATE - u.u_caf)::int END,
    CASE WHEN u.u_reg IS NULL THEN NULL ELSE (CURRENT_DATE - u.u_reg)::int END,
    u.u_caf,
    u.u_reg,
    COALESCE((SELECT r.recorde_dias FROM public.dias_sem_acidente_recordes r
              WHERE r.company_id = u.cid AND r.escopo='COM_AFASTAMENTO'),0),
    COALESCE((SELECT r.recorde_dias FROM public.dias_sem_acidente_recordes r
              WHERE r.company_id = u.cid AND r.escopo='REGISTRAVEL'),0)
  FROM ult u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dias_sem_acidente(UUID) TO authenticated;

-- =========================================================
-- TRIGGER: atualiza recorde automaticamente ao registrar acidente
-- =========================================================
CREATE OR REPLACE FUNCTION public.atualizar_recorde_dias_sem_acidente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ult DATE;
  v_dias INT;
  v_recorde INT;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;

  -- COM_AFASTAMENTO/FATAL zera contador principal
  IF NEW.tipo IN ('COM_AFASTAMENTO','FATAL') THEN
    SELECT MAX(data_acidente) INTO v_ult
      FROM public.acidentes_trabalho
     WHERE company_id = NEW.company_id
       AND tipo IN ('COM_AFASTAMENTO','FATAL')
       AND id <> NEW.id;
    IF v_ult IS NOT NULL THEN
      v_dias := (NEW.data_acidente - v_ult)::int;
      SELECT recorde_dias INTO v_recorde
        FROM public.dias_sem_acidente_recordes
       WHERE company_id = NEW.company_id AND escopo='COM_AFASTAMENTO';
      IF v_recorde IS NULL OR v_dias > v_recorde THEN
        INSERT INTO public.dias_sem_acidente_recordes(company_id, escopo, recorde_dias, data_inicio, data_recorde)
        VALUES (NEW.company_id, 'COM_AFASTAMENTO', v_dias, v_ult, NEW.data_acidente)
        ON CONFLICT (company_id, escopo) DO UPDATE
          SET recorde_dias = EXCLUDED.recorde_dias,
              data_inicio = EXCLUDED.data_inicio,
              data_recorde = EXCLUDED.data_recorde,
              updated_at = now();
      END IF;
    END IF;
  END IF;

  -- Qualquer acidente zera contador "registrável"
  SELECT MAX(data_acidente) INTO v_ult
    FROM public.acidentes_trabalho
   WHERE company_id = NEW.company_id AND id <> NEW.id;
  IF v_ult IS NOT NULL THEN
    v_dias := (NEW.data_acidente - v_ult)::int;
    SELECT recorde_dias INTO v_recorde
      FROM public.dias_sem_acidente_recordes
     WHERE company_id = NEW.company_id AND escopo='REGISTRAVEL';
    IF v_recorde IS NULL OR v_dias > v_recorde THEN
      INSERT INTO public.dias_sem_acidente_recordes(company_id, escopo, recorde_dias, data_inicio, data_recorde)
      VALUES (NEW.company_id, 'REGISTRAVEL', v_dias, v_ult, NEW.data_acidente)
      ON CONFLICT (company_id, escopo) DO UPDATE
        SET recorde_dias = EXCLUDED.recorde_dias,
            data_inicio = EXCLUDED.data_inicio,
            data_recorde = EXCLUDED.data_recorde,
            updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acidentes_recorde ON public.acidentes_trabalho;
CREATE TRIGGER trg_acidentes_recorde
  AFTER INSERT ON public.acidentes_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_recorde_dias_sem_acidente();

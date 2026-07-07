
-- ============================================================
-- TIPOS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.portaria_visita_tipo AS ENUM ('VISITANTE','FORNECEDOR','PRESTADOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.portaria_visita_status AS ENUM ('DENTRO','SAIDA_VALIDADA','CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABELAS DE CADASTRO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portaria_pessoas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf                  TEXT NOT NULL UNIQUE,
  nome                 TEXT NOT NULL,
  rg                   TEXT,
  cnpj                 TEXT,
  foto_documento_url   TEXT,
  observacoes          TEXT,
  bloqueado            BOOLEAN NOT NULL DEFAULT false,
  motivo_bloqueio      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT portaria_pessoas_cpf_format CHECK (cpf ~ '^\d{11}$')
);
CREATE INDEX IF NOT EXISTS idx_portaria_pessoas_nome ON public.portaria_pessoas (lower(nome));

GRANT SELECT, INSERT, UPDATE ON public.portaria_pessoas TO authenticated;
GRANT ALL ON public.portaria_pessoas TO service_role;
ALTER TABLE public.portaria_pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_pessoas_select" ON public.portaria_pessoas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portaria_pessoas_insert" ON public.portaria_pessoas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'porteiro'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );
CREATE POLICY "portaria_pessoas_update" ON public.portaria_pessoas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
    OR public.has_role(auth.uid(),'porteiro'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.portaria_veiculos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa       TEXT NOT NULL UNIQUE,
  modelo      TEXT,
  cor         TEXT,
  tipo        TEXT CHECK (tipo IN ('CARRO','MOTO','CAMINHAO','VAN','ONIBUS','OUTRO')),
  observacoes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT portaria_veiculos_placa_format
    CHECK (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$')
);

GRANT SELECT, INSERT, UPDATE ON public.portaria_veiculos TO authenticated;
GRANT ALL ON public.portaria_veiculos TO service_role;
ALTER TABLE public.portaria_veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_veiculos_select" ON public.portaria_veiculos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portaria_veiculos_insert" ON public.portaria_veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'porteiro'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );
CREATE POLICY "portaria_veiculos_update" ON public.portaria_veiculos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
    OR public.has_role(auth.uid(),'porteiro'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.portaria_fornecedores_recorrentes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id            UUID NOT NULL REFERENCES public.portaria_pessoas(id) ON DELETE CASCADE,
  company_id           UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  empresa_terceira_id  UUID REFERENCES public.empresas_terceiras(id) ON DELETE SET NULL,
  funcao               TEXT,
  ativo                BOOLEAN NOT NULL DEFAULT true,
  observacoes          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_portaria_forn_pessoa ON public.portaria_fornecedores_recorrentes(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_portaria_forn_company ON public.portaria_fornecedores_recorrentes(company_id) WHERE company_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.portaria_fornecedores_recorrentes TO authenticated;
GRANT ALL ON public.portaria_fornecedores_recorrentes TO service_role;
ALTER TABLE public.portaria_fornecedores_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_forn_select" ON public.portaria_fornecedores_recorrentes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portaria_forn_insert" ON public.portaria_fornecedores_recorrentes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );
CREATE POLICY "portaria_forn_update" ON public.portaria_fornecedores_recorrentes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );

-- ============================================================
-- TABELAS DE EVENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portaria_visitas (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                      public.portaria_visita_tipo NOT NULL,
  pessoa_id                 UUID NOT NULL REFERENCES public.portaria_pessoas(id) ON DELETE RESTRICT,
  veiculo_id                UUID REFERENCES public.portaria_veiculos(id) ON DELETE SET NULL,
  empresa_visitada_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  funcionario_recebedor_id  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  motivo_visita             TEXT,
  foto_rosto_url            TEXT,
  foto_placa_url            TEXT,
  foto_bagageiro_url        TEXT,
  entrada_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  saida_at                  TIMESTAMPTZ,
  entrada_por_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  saida_por_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status                    public.portaria_visita_status NOT NULL DEFAULT 'DENTRO',
  motivo_cancelamento       TEXT,
  observacoes               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT visita_saida_coerente CHECK (
    (status = 'DENTRO'          AND saida_at IS NULL) OR
    (status = 'SAIDA_VALIDADA'  AND saida_at IS NOT NULL) OR
    (status = 'CANCELADA')
  )
);
CREATE INDEX IF NOT EXISTS idx_visitas_status_entrada ON public.portaria_visitas(status, entrada_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_entrada_at    ON public.portaria_visitas(entrada_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_pessoa        ON public.portaria_visitas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_visitas_veiculo       ON public.portaria_visitas(veiculo_id) WHERE veiculo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitas_empresa       ON public.portaria_visitas(empresa_visitada_id);

GRANT SELECT, INSERT, UPDATE ON public.portaria_visitas TO authenticated;
GRANT ALL ON public.portaria_visitas TO service_role;
ALTER TABLE public.portaria_visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_visitas_select" ON public.portaria_visitas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portaria_visitas_insert" ON public.portaria_visitas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'porteiro'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );
CREATE POLICY "portaria_visitas_update" ON public.portaria_visitas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
    OR (public.has_role(auth.uid(),'porteiro'::app_role) AND status = 'DENTRO')
  );

CREATE TABLE IF NOT EXISTS public.portaria_visita_acompanhantes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id      UUID NOT NULL REFERENCES public.portaria_visitas(id) ON DELETE CASCADE,
  pessoa_id      UUID NOT NULL REFERENCES public.portaria_pessoas(id) ON DELETE RESTRICT,
  foto_rosto_url TEXT,
  ordem          SMALLINT NOT NULL DEFAULT 1 CHECK (ordem BETWEEN 1 AND 2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visita_id, ordem)
);
CREATE INDEX IF NOT EXISTS idx_visita_acompanhantes_visita ON public.portaria_visita_acompanhantes(visita_id);

GRANT SELECT, INSERT, UPDATE ON public.portaria_visita_acompanhantes TO authenticated;
GRANT ALL ON public.portaria_visita_acompanhantes TO service_role;
ALTER TABLE public.portaria_visita_acompanhantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_acomp_select" ON public.portaria_visita_acompanhantes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portaria_acomp_insert" ON public.portaria_visita_acompanhantes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'porteiro'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );
CREATE POLICY "portaria_acomp_update" ON public.portaria_visita_acompanhantes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.portaria_saidas_funcionarios (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saida_expediente_id  UUID NOT NULL UNIQUE
                         REFERENCES public.employee_saidas_expediente(id) ON DELETE RESTRICT,
  employee_id          UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  validada_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  validada_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao_portaria  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saidas_func_employee ON public.portaria_saidas_funcionarios(employee_id, validada_at DESC);

GRANT SELECT, INSERT ON public.portaria_saidas_funcionarios TO authenticated;
GRANT ALL ON public.portaria_saidas_funcionarios TO service_role;
ALTER TABLE public.portaria_saidas_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_saidas_func_select" ON public.portaria_saidas_funcionarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portaria_saidas_func_insert" ON public.portaria_saidas_funcionarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'porteiro'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );

-- ============================================================
-- AUDITORIA IMUTÁVEL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portaria_auditoria (
  id             BIGSERIAL PRIMARY KEY,
  entidade       TEXT NOT NULL,
  entidade_id    UUID,
  acao           TEXT NOT NULL,
  snapshot_json  JSONB NOT NULL,
  user_id        UUID,
  origem_modulo  TEXT NOT NULL DEFAULT 'portaria',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portaria_audit_entidade ON public.portaria_auditoria(entidade, entidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_portaria_audit_criado   ON public.portaria_auditoria(criado_em DESC);

GRANT SELECT ON public.portaria_auditoria TO authenticated;
GRANT ALL ON public.portaria_auditoria TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.portaria_auditoria_id_seq TO authenticated, service_role;
ALTER TABLE public.portaria_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portaria_audit_select_admin" ON public.portaria_auditoria
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tst'::app_role)
  );

CREATE OR REPLACE FUNCTION public.portaria_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE'
               THEN (row_to_json(OLD)->>'id')::uuid
               ELSE (row_to_json(NEW)->>'id')::uuid END;
  INSERT INTO public.portaria_auditoria (entidade, entidade_id, acao, snapshot_json, user_id)
  VALUES (
    TG_TABLE_NAME,
    v_id,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.portaria_audit_trigger() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.portaria_visitas_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('SAIDA_VALIDADA','CANCELADA')
     AND NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Visita já finalizada — só admin pode corrigir';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.portaria_visitas_guard() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_portaria_visitas_guard ON public.portaria_visitas;
CREATE TRIGGER trg_portaria_visitas_guard
  BEFORE UPDATE ON public.portaria_visitas
  FOR EACH ROW EXECUTE FUNCTION public.portaria_visitas_guard();

DROP TRIGGER IF EXISTS trg_audit_portaria_pessoas ON public.portaria_pessoas;
CREATE TRIGGER trg_audit_portaria_pessoas
  AFTER INSERT OR UPDATE ON public.portaria_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.portaria_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_portaria_veiculos ON public.portaria_veiculos;
CREATE TRIGGER trg_audit_portaria_veiculos
  AFTER INSERT OR UPDATE ON public.portaria_veiculos
  FOR EACH ROW EXECUTE FUNCTION public.portaria_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_portaria_visitas ON public.portaria_visitas;
CREATE TRIGGER trg_audit_portaria_visitas
  AFTER INSERT OR UPDATE ON public.portaria_visitas
  FOR EACH ROW EXECUTE FUNCTION public.portaria_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_portaria_saidas_func ON public.portaria_saidas_funcionarios;
CREATE TRIGGER trg_audit_portaria_saidas_func
  AFTER INSERT ON public.portaria_saidas_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.portaria_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_portaria_forn ON public.portaria_fornecedores_recorrentes;
CREATE TRIGGER trg_audit_portaria_forn
  AFTER INSERT OR UPDATE ON public.portaria_fornecedores_recorrentes
  FOR EACH ROW EXECUTE FUNCTION public.portaria_audit_trigger();

-- updated_at automático
CREATE OR REPLACE FUNCTION public.portaria_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_portaria_pessoas ON public.portaria_pessoas;
CREATE TRIGGER trg_touch_portaria_pessoas BEFORE UPDATE ON public.portaria_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.portaria_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_portaria_veiculos ON public.portaria_veiculos;
CREATE TRIGGER trg_touch_portaria_veiculos BEFORE UPDATE ON public.portaria_veiculos
  FOR EACH ROW EXECUTE FUNCTION public.portaria_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_portaria_forn ON public.portaria_fornecedores_recorrentes;
CREATE TRIGGER trg_touch_portaria_forn BEFORE UPDATE ON public.portaria_fornecedores_recorrentes
  FOR EACH ROW EXECUTE FUNCTION public.portaria_touch_updated_at();

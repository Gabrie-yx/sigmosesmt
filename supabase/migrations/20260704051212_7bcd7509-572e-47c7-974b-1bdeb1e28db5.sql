
-- =========================================================================
-- EXTRA DE SÁBADO — Painel Mobile dos Marcadores
-- =========================================================================

-- 1) Novo role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'extra_sabado_marcador';

-- =========================================================================
-- 2) Configuração dos marcadores (escopo do que cada um pode marcar)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.hora_extra_marcadores (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  -- Escopo do que ele pode marcar. Formatos suportados:
  --   { "tipo": "TUDO" }                                          -- Manoel
  --   { "tipo": "SETOR",  "valores": ["ELETRICA"] }               -- Natanael
  --   { "tipo": "SELF",   "employee_id": "uuid" }                 -- Paulo Sérgio
  --   { "tipo": "EMPRESA_TERCEIRA", "ids": ["uuid", ...] }        -- Renato (LF)
  --   { "tipo": "DMN_APOIO", "setores": ["ALMOX","SG","ADM","PORTARIA"] } -- Daniel
  escopo        jsonb NOT NULL DEFAULT '{"tipo":"SELF"}'::jsonb,
  self_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  criado_por    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hora_extra_marcadores TO authenticated;
GRANT ALL ON public.hora_extra_marcadores TO service_role;

ALTER TABLE public.hora_extra_marcadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcadores_select_self_or_admin" ON public.hora_extra_marcadores
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'tst'::public.app_role)
  OR public.has_role(auth.uid(), 'moderador'::public.app_role)
);

CREATE POLICY "marcadores_write_admin" ON public.hora_extra_marcadores
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'tst'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'tst'::public.app_role)
);

CREATE TRIGGER trg_hora_extra_marcadores_updated
BEFORE UPDATE ON public.hora_extra_marcadores
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- 3) hora_extra_sabado — novas colunas de janela / autoria
-- =========================================================================
ALTER TABLE public.hora_extra_sabado
  ADD COLUMN IF NOT EXISTS aberto_marcadores_em    timestamptz,
  ADD COLUMN IF NOT EXISTS marcadores_edit_ate     timestamptz,
  ADD COLUMN IF NOT EXISTS marcadores_expira_em    timestamptz,
  ADD COLUMN IF NOT EXISTS aberto_por              uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aberto_por_nome         text,
  ADD COLUMN IF NOT EXISTS criado_automatico       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criado_automatico_por_nome text;

CREATE INDEX IF NOT EXISTS idx_hora_extra_sabado_expira
  ON public.hora_extra_sabado(marcadores_expira_em)
  WHERE marcadores_expira_em IS NOT NULL;

-- =========================================================================
-- 4) hora_extra_sabado_funcionarios — auditoria + empresa livre p/ externos
-- =========================================================================
ALTER TABLE public.hora_extra_sabado_funcionarios
  ADD COLUMN IF NOT EXISTS marcado_por          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS marcado_por_nome     text,
  ADD COLUMN IF NOT EXISTS marcado_em           timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS externo_empresa      text;

-- =========================================================================
-- 5) Helper: pode gerir Extra de Sábado (admin/tst/moderador)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.pode_gerir_extra_sabado(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'tst'::public.app_role)
    OR public.has_role(_user_id, 'moderador'::public.app_role);
$$;

-- =========================================================================
-- 6) Helper: dado um employee, ele cai no escopo do marcador?
-- =========================================================================
CREATE OR REPLACE FUNCTION public.marcador_pode_marcar_employee(
  _marcador_user_id uuid,
  _employee_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_escopo jsonb;
  v_tipo text;
  v_self uuid;
  v_emp record;
BEGIN
  SELECT escopo, self_employee_id INTO v_escopo, v_self
    FROM public.hora_extra_marcadores
   WHERE user_id = _marcador_user_id AND ativo = true;
  IF v_escopo IS NULL THEN RETURN false; END IF;

  v_tipo := v_escopo->>'tipo';

  SELECT id, setor, tipo_vinculo, empresa_terceira_id
    INTO v_emp FROM public.employees WHERE id = _employee_id;
  IF v_emp.id IS NULL THEN RETURN false; END IF;

  IF v_tipo = 'TUDO' THEN
    RETURN true;

  ELSIF v_tipo = 'SELF' THEN
    RETURN v_emp.id = v_self;

  ELSIF v_tipo = 'SETOR' THEN
    RETURN v_emp.setor = ANY(
      SELECT jsonb_array_elements_text(v_escopo->'valores')
    );

  ELSIF v_tipo = 'EMPRESA_TERCEIRA' THEN
    RETURN v_emp.empresa_terceira_id::text = ANY(
      SELECT jsonb_array_elements_text(v_escopo->'ids')
    );

  ELSIF v_tipo = 'DMN_APOIO' THEN
    -- DMN direto (não terceirizado) num dos setores listados
    RETURN v_emp.tipo_vinculo IN ('CLT','MEI')
       AND v_emp.empresa_terceira_id IS NULL
       AND v_emp.setor = ANY(
         SELECT jsonb_array_elements_text(v_escopo->'setores')
       );
  END IF;

  RETURN false;
END;
$$;

-- =========================================================================
-- 7) Convocações visíveis pro marcador (só abertas / não expiradas)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.hora_extra_marcador_visivel(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hora_extra_sabado h
    JOIN public.hora_extra_marcadores m ON m.user_id = _user_id AND m.ativo = true
    WHERE h.id = _conv_id
      AND h.aberto_marcadores_em IS NOT NULL
      AND (h.marcadores_expira_em IS NULL OR h.marcadores_expira_em > now())
  );
$$;

-- =========================================================================
-- 8) RLS — marcadores enxergam convocações abertas + próprias marcações
-- =========================================================================

-- SELECT em hora_extra_sabado: marcador só vê convocações abertas e não expiradas
DROP POLICY IF EXISTS "extra_sabado_select_marcador" ON public.hora_extra_sabado;
CREATE POLICY "extra_sabado_select_marcador" ON public.hora_extra_sabado
FOR SELECT TO authenticated
USING (
  aberto_marcadores_em IS NOT NULL
  AND (marcadores_expira_em IS NULL OR marcadores_expira_em > now())
  AND EXISTS (SELECT 1 FROM public.hora_extra_marcadores m
              WHERE m.user_id = auth.uid() AND m.ativo = true)
);

-- SELECT em funcionários: marcador vê os da convocação aberta
DROP POLICY IF EXISTS "extra_sabado_func_select_marcador" ON public.hora_extra_sabado_funcionarios;
CREATE POLICY "extra_sabado_func_select_marcador" ON public.hora_extra_sabado_funcionarios
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hora_extra_marcadores m
          WHERE m.user_id = auth.uid() AND m.ativo = true)
  AND EXISTS (SELECT 1 FROM public.hora_extra_sabado h
              WHERE h.id = hora_extra_id
                AND h.aberto_marcadores_em IS NOT NULL
                AND (h.marcadores_expira_em IS NULL OR h.marcadores_expira_em > now()))
);

-- =========================================================================
-- 9) RPCs (marcar/desmarcar/adicionar externo/abrir)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.abrir_convocacao_marcadores(
  _hora_extra_id uuid,
  _edit_ate timestamptz DEFAULT NULL,
  _expira_em timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_data date;
  v_sexta date;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_gerir_extra_sabado(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para abrir convocação de sábado';
  END IF;

  SELECT data INTO v_data FROM public.hora_extra_sabado WHERE id = _hora_extra_id;
  IF v_data IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  -- Sexta anterior ao sábado da convocação
  v_sexta := v_data - INTERVAL '1 day';

  SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.hora_extra_sabado SET
    aberto_marcadores_em = now(),
    aberto_por = v_uid,
    aberto_por_nome = COALESCE(v_nome, 'Admin'),
    marcadores_edit_ate = COALESCE(_edit_ate,
      (v_sexta::timestamp + TIME '18:29:59') AT TIME ZONE 'America/Sao_Paulo'),
    marcadores_expira_em = COALESCE(_expira_em,
      (v_sexta::timestamp + TIME '19:00:00') AT TIME ZONE 'America/Sao_Paulo')
  WHERE id = _hora_extra_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fechar_convocacao_marcadores(_hora_extra_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_gerir_extra_sabado(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.hora_extra_sabado
     SET marcadores_expira_em = now()
   WHERE id = _hora_extra_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_funcionario_sabado(
  _hora_extra_id uuid,
  _employee_id uuid,
  _transporte boolean DEFAULT true,
  _alimentacao boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_marcador boolean;
  v_conv record;
  v_nome text;
  v_marc_nome text;
  v_emp_nome text;
  v_emp_setor text;
  v_max_ordem int;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    INTO v_marcador;

  IF NOT (v_admin OR v_marcador) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT id, aberto_marcadores_em, marcadores_edit_ate, marcadores_expira_em
    INTO v_conv FROM public.hora_extra_sabado WHERE id = _hora_extra_id FOR UPDATE;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  -- Admin sempre pode; marcador precisa de janela aberta
  IF NOT v_admin THEN
    IF v_conv.aberto_marcadores_em IS NULL THEN
      RAISE EXCEPTION 'Convocação ainda não foi aberta para marcadores';
    END IF;
    IF v_conv.marcadores_edit_ate IS NOT NULL AND now() > v_conv.marcadores_edit_ate THEN
      RAISE EXCEPTION 'Janela de edição encerrada (após sexta 18:29)';
    END IF;
    IF v_conv.marcadores_expira_em IS NOT NULL AND now() > v_conv.marcadores_expira_em THEN
      RAISE EXCEPTION 'Convocação encerrada';
    END IF;
    -- Valida escopo
    IF NOT public.marcador_pode_marcar_employee(v_uid, _employee_id) THEN
      RAISE EXCEPTION 'Este funcionário está fora do seu escopo';
    END IF;
  END IF;

  -- Já marcado? Retorna o id existente
  SELECT id INTO v_row_id
    FROM public.hora_extra_sabado_funcionarios
   WHERE hora_extra_id = _hora_extra_id AND employee_id = _employee_id;
  IF v_row_id IS NOT NULL THEN RETURN v_row_id; END IF;

  SELECT nome, setor INTO v_emp_nome, v_emp_setor
    FROM public.employees WHERE id = _employee_id;
  IF v_emp_nome IS NULL THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
    FROM public.hora_extra_sabado_funcionarios WHERE hora_extra_id = _hora_extra_id;

  SELECT full_name INTO v_marc_nome FROM public.profiles WHERE id = v_uid;
  IF v_marc_nome IS NULL THEN
    SELECT email INTO v_marc_nome FROM auth.users WHERE id = v_uid;
  END IF;

  INSERT INTO public.hora_extra_sabado_funcionarios (
    hora_extra_id, employee_id, nome, externo, funcao,
    transporte, alimentacao, ordem,
    marcado_por, marcado_por_nome, marcado_em
  ) VALUES (
    _hora_extra_id, _employee_id, v_emp_nome, false, v_emp_setor,
    COALESCE(_transporte, true), COALESCE(_alimentacao, true), v_max_ordem,
    v_uid, v_marc_nome, now()
  ) RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.desmarcar_funcionario_sabado(_row_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_row record;
  v_conv record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_admin := public.pode_gerir_extra_sabado(v_uid);

  SELECT * INTO v_row FROM public.hora_extra_sabado_funcionarios WHERE id = _row_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;

  IF NOT v_admin THEN
    -- Precisa ser marcador ativo, ter sido quem marcou, e janela aberta
    IF NOT EXISTS (SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true) THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
    IF v_row.marcado_por IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Só quem marcou pode desmarcar';
    END IF;
    SELECT marcadores_edit_ate, marcadores_expira_em INTO v_conv
      FROM public.hora_extra_sabado WHERE id = v_row.hora_extra_id;
    IF v_conv.marcadores_edit_ate IS NOT NULL AND now() > v_conv.marcadores_edit_ate THEN
      RAISE EXCEPTION 'Janela de edição encerrada';
    END IF;
  END IF;

  DELETE FROM public.hora_extra_sabado_funcionarios WHERE id = _row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adicionar_externo_sabado(
  _hora_extra_id uuid,
  _nome text,
  _empresa text,
  _funcao text DEFAULT NULL,
  _transporte boolean DEFAULT true,
  _alimentacao boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_marcador boolean;
  v_conv record;
  v_marc_nome text;
  v_max_ordem int;
  v_row_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _nome IS NULL OR length(btrim(_nome)) < 3 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF _empresa IS NULL OR length(btrim(_empresa)) < 2 THEN
    RAISE EXCEPTION 'Informe a empresa do externo';
  END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    INTO v_marcador;
  IF NOT (v_admin OR v_marcador) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT id, aberto_marcadores_em, marcadores_edit_ate, marcadores_expira_em
    INTO v_conv FROM public.hora_extra_sabado WHERE id = _hora_extra_id FOR UPDATE;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  IF NOT v_admin THEN
    IF v_conv.aberto_marcadores_em IS NULL THEN
      RAISE EXCEPTION 'Convocação não foi aberta para marcadores';
    END IF;
    IF v_conv.marcadores_edit_ate IS NOT NULL AND now() > v_conv.marcadores_edit_ate THEN
      RAISE EXCEPTION 'Janela encerrada';
    END IF;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
    FROM public.hora_extra_sabado_funcionarios WHERE hora_extra_id = _hora_extra_id;

  SELECT full_name INTO v_marc_nome FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.hora_extra_sabado_funcionarios (
    hora_extra_id, employee_id, nome, externo, funcao, externo_empresa,
    transporte, alimentacao, ordem,
    marcado_por, marcado_por_nome, marcado_em
  ) VALUES (
    _hora_extra_id, NULL, btrim(_nome), true, NULLIF(btrim(COALESCE(_funcao,'')),''), btrim(_empresa),
    COALESCE(_transporte, true), COALESCE(_alimentacao, true), v_max_ordem,
    v_uid, v_marc_nome, now()
  ) RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

-- =========================================================================
-- 10) Get-or-create convocação em branco pro próximo sábado (para marcadores)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_convocacao_sabado_atual()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_marcador boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow int;
  v_sabado date;
  v_sexta date;
  v_id uuid;
  v_nome text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    INTO v_marcador;
  IF NOT (v_admin OR v_marcador) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  -- Próximo sábado (se hoje é sábado, hoje mesmo)
  v_dow := EXTRACT(DOW FROM v_hoje); -- 0=domingo, 6=sábado
  v_sabado := v_hoje + ((6 - v_dow + 7) % 7);
  v_sexta := v_sabado - 1;

  -- Convocação já aberta pros marcadores nesse sábado?
  SELECT id INTO v_id FROM public.hora_extra_sabado
   WHERE data = v_sabado
     AND aberto_marcadores_em IS NOT NULL
     AND (marcadores_expira_em IS NULL OR marcadores_expira_em > now())
   ORDER BY aberto_marcadores_em DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Qualquer convocação existente pro sábado (ainda não aberta)?
  SELECT id INTO v_id FROM public.hora_extra_sabado
   WHERE data = v_sabado ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    -- Cria em branco e já abre
    SELECT full_name INTO v_nome FROM public.profiles WHERE id = v_uid;
    INSERT INTO public.hora_extra_sabado (
      data, tipo_efetivo, created_by, criado_automatico, criado_automatico_por_nome
    ) VALUES (
      v_sabado, 'DMN', v_uid, NOT v_admin, CASE WHEN v_admin THEN NULL ELSE COALESCE(v_nome, 'Marcador') END
    ) RETURNING id INTO v_id;
  END IF;

  -- Abre pros marcadores
  PERFORM public.abrir_convocacao_marcadores(v_id, NULL, NULL);

  RETURN v_id;
END;
$$;

-- =========================================================================
-- 11) Realtime na tabela de funcionários (marcadores veem update mútuo)
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.hora_extra_sabado_funcionarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hora_extra_sabado;

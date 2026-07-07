
-- 1) Tabela do pacote de rescisão SST
CREATE TABLE public.desligamento_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','EMITIDO','CANCELADO')),
  data_desligamento date NOT NULL,
  motivo text NOT NULL,
  motivo_detalhe text,
  aso_exam_id uuid REFERENCES public.employee_exams(id) ON DELETE SET NULL,
  aso_dispensado boolean NOT NULL DEFAULT false,
  aso_dispensa_justificativa text,
  ppp_emissao_id uuid REFERENCES public.ppp_emissoes(id) ON DELETE SET NULL,
  epis_devolvidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  epis_pendentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  termo_epi_url text,
  termo_encerramento_url text,
  oss_afetadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  sha256_snapshot text,
  emitido_em timestamptz,
  emitido_por uuid,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_desl_pac_employee ON public.desligamento_pacotes(employee_id);
CREATE INDEX idx_desl_pac_status ON public.desligamento_pacotes(status);
CREATE UNIQUE INDEX uq_desl_pac_emitido_por_employee
  ON public.desligamento_pacotes(employee_id) WHERE status = 'EMITIDO';

GRANT SELECT, INSERT, UPDATE ON public.desligamento_pacotes TO authenticated;
GRANT ALL ON public.desligamento_pacotes TO service_role;

ALTER TABLE public.desligamento_pacotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editores leem pacotes"
  ON public.desligamento_pacotes FOR SELECT TO authenticated
  USING (public.is_editor(auth.uid()));

CREATE POLICY "editores criam pacotes"
  ON public.desligamento_pacotes FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "editores atualizam rascunhos"
  ON public.desligamento_pacotes FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()) AND status = 'RASCUNHO')
  WITH CHECK (public.is_editor(auth.uid()));

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_desl_pac_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_desl_pac_updated_at
  BEFORE UPDATE ON public.desligamento_pacotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_desl_pac_updated_at();

-- 2) RPC de finalização
CREATE OR REPLACE FUNCTION public.finalizar_desligamento_pacote(_pacote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  r public.desligamento_pacotes%ROWTYPE;
  v_hash text;
BEGIN
  IF v_user IS NULL OR NOT public.is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar pacote de rescisão';
  END IF;

  SELECT * INTO r FROM public.desligamento_pacotes WHERE id = _pacote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado'; END IF;
  IF r.status <> 'RASCUNHO' THEN RAISE EXCEPTION 'Pacote já finalizado'; END IF;

  IF r.aso_exam_id IS NULL AND NOT r.aso_dispensado THEN
    RAISE EXCEPTION 'ASO demissional obrigatório (NR-07) — informe o exame ou registre a dispensa';
  END IF;
  IF r.aso_dispensado AND (r.aso_dispensa_justificativa IS NULL OR length(trim(r.aso_dispensa_justificativa)) < 10) THEN
    RAISE EXCEPTION 'Dispensa do ASO exige justificativa (mín. 10 caracteres)';
  END IF;

  -- Aciona desligamento (marca employees.status=DESLIGADO)
  PERFORM public.registrar_desligamento_funcionario(
    r.employee_id, r.data_desligamento, r.motivo, r.observacoes, r.checklist
  );

  -- Hash de integridade
  v_hash := encode(digest(
    coalesce(r.employee_id::text,'') || '|' || coalesce(r.data_desligamento::text,'') || '|' ||
    coalesce(r.motivo,'') || '|' || coalesce(r.aso_exam_id::text,'') || '|' ||
    coalesce(r.ppp_emissao_id::text,'') || '|' || coalesce(r.epis_devolvidos::text,'[]') || '|' ||
    coalesce(r.oss_afetadas::text,'[]'),
    'sha256'), 'hex');

  UPDATE public.desligamento_pacotes
     SET status = 'EMITIDO',
         emitido_em = now(),
         emitido_por = v_user,
         sha256_snapshot = v_hash
   WHERE id = _pacote_id;

  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (v_user, 'RESCISAO_PACOTE_EMITIDO', 'desligamento_pacotes', _pacote_id,
            jsonb_build_object(
              'employee_id', r.employee_id,
              'data_desligamento', r.data_desligamento,
              'sha256', v_hash,
              'aso_dispensado', r.aso_dispensado,
              'ppp_emissao_id', r.ppp_emissao_id
            ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_desligamento_pacote(uuid) TO authenticated;

-- 3) View de pendências
CREATE OR REPLACE VIEW public.v_desligamento_pendencias AS
SELECT
  e.id AS employee_id,
  e.nome,
  e.company_id,
  e.data_desligamento,
  e.motivo_desligamento,
  (SELECT count(*) FROM public.desligamento_pacotes p
     WHERE p.employee_id = e.id AND p.status = 'EMITIDO') AS pacotes_emitidos,
  (SELECT count(*) FROM public.desligamento_pacotes p
     WHERE p.employee_id = e.id AND p.status = 'RASCUNHO') AS pacotes_rascunho
FROM public.employees e
WHERE e.status = 'DESLIGADO'
  AND NOT EXISTS (
    SELECT 1 FROM public.desligamento_pacotes p
     WHERE p.employee_id = e.id AND p.status = 'EMITIDO'
  );

GRANT SELECT ON public.v_desligamento_pendencias TO authenticated;

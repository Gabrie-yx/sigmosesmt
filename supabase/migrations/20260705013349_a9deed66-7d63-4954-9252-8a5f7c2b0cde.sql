ALTER TABLE public.hora_extra_sabado
  ADD COLUMN IF NOT EXISTS modulo_origem text;

COMMENT ON COLUMN public.hora_extra_sabado.modulo_origem IS
  'Módulo de origem da ficha de hora extra: almoxarifado, manutencao, mecanica, eletrica, producao, compras, portaria, administrativo ou sesmt.';

CREATE INDEX IF NOT EXISTS idx_hora_extra_sabado_modulo_status_data
  ON public.hora_extra_sabado (modulo_origem, status, data DESC);

CREATE OR REPLACE FUNCTION public.normalizar_modulo_hora_extra(_raw text, _setor text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := lower(trim(coalesce(nullif(_raw, ''), nullif(_setor, ''), '')));
  v := translate(v, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');

  IF v = '' THEN RETURN NULL; END IF;
  IF v LIKE '%almox%' THEN RETURN 'almoxarifado'; END IF;
  IF v LIKE '%manut%' THEN RETURN 'manutencao'; END IF;
  IF v LIKE '%mecan%' THEN RETURN 'mecanica'; END IF;
  IF v LIKE '%eletric%' THEN RETURN 'eletrica'; END IF;
  IF v LIKE '%produ%' THEN RETURN 'producao'; END IF;
  IF v LIKE '%compr%' THEN RETURN 'compras'; END IF;
  IF v LIKE '%portar%' THEN RETURN 'portaria'; END IF;
  IF v LIKE '%admin%' THEN RETURN 'administrativo'; END IF;
  IF v LIKE '%sesmt%' THEN RETURN 'sesmt'; END IF;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotulo_modulo_hora_extra(_modulo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.normalizar_modulo_hora_extra(_modulo, NULL)
    WHEN 'almoxarifado' THEN 'Almoxarifado'
    WHEN 'manutencao' THEN 'Manutenção'
    WHEN 'mecanica' THEN 'Mecânica'
    WHEN 'eletrica' THEN 'Elétrica'
    WHEN 'producao' THEN 'Produção'
    WHEN 'compras' THEN 'Compras'
    WHEN 'portaria' THEN 'Portaria'
    WHEN 'administrativo' THEN 'Administrativo'
    WHEN 'sesmt' THEN 'SESMT'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_hora_extra_modulo_origem()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.modulo_origem := public.normalizar_modulo_hora_extra(NEW.modulo_origem, NEW.setor);

  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'PENDENTE';
  END IF;

  IF NEW.tipo_convocacao IS NULL OR btrim(NEW.tipo_convocacao) = '' THEN
    NEW.tipo_convocacao := CASE
      WHEN NEW.data IS NOT NULL AND extract(dow from NEW.data) = 6 THEN 'SABADO'
      ELSE 'DIAS_UTEIS'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hora_extra_sabado_modulo_origem ON public.hora_extra_sabado;
CREATE TRIGGER trg_hora_extra_sabado_modulo_origem
  BEFORE INSERT OR UPDATE OF setor, modulo_origem, status, tipo_convocacao
  ON public.hora_extra_sabado
  FOR EACH ROW
  EXECUTE FUNCTION public.set_hora_extra_modulo_origem();

UPDATE public.hora_extra_sabado
   SET modulo_origem = public.normalizar_modulo_hora_extra(modulo_origem, setor)
 WHERE modulo_origem IS NULL;

-- Resgata a ficha citada do Almoxarifado que ficou indeferida como Manutenção.
UPDATE public.hora_extra_sabado
   SET modulo_origem = 'almoxarifado',
       setor = 'Almoxarifado',
       updated_at = now()
 WHERE id = '17417122-0483-423a-8b9d-cfbf93a73b13'
   AND status = 'INDEFERIDA';

DROP FUNCTION IF EXISTS public.criar_convocacao_extra_lider(text, date, text, text, text);
DROP FUNCTION IF EXISTS public.criar_convocacao_extra_lider(text, date, text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.criar_convocacao_extra_lider(text, date, text, text, text, uuid[], text);
DROP FUNCTION IF EXISTS public.criar_convocacao_extra_lider(text, date, text, text, text, uuid[], text, text);

CREATE OR REPLACE FUNCTION public.criar_convocacao_extra_lider(
  _tipo text,
  _data date,
  _horario_inicio text,
  _horario_fim text,
  _justificativa text,
  _employee_ids uuid[] DEFAULT NULL,
  _turno text DEFAULT NULL,
  _modulo_origem text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lider record;
  v_id uuid;
  v_nome text;
  v_setor text;
  v_modulo text;
  v_emp_id uuid;
  v_emp_nome text;
  v_emp_funcao text;
  v_convocaveis uuid[];
BEGIN
  SELECT * INTO v_lider FROM public.meu_lider_extra();
  IF v_lider.id IS NULL THEN
    RAISE EXCEPTION 'Você não está cadastrado como líder de convocação de extra';
  END IF;

  IF _tipo NOT IN ('SABADO','DIAS_UTEIS') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  IF _data IS NULL OR _horario_inicio IS NULL OR _horario_fim IS NULL THEN
    RAISE EXCEPTION 'Informe data, hora início e hora fim';
  END IF;
  IF _justificativa IS NULL OR length(btrim(_justificativa)) < 5 THEN
    RAISE EXCEPTION 'Justificativa é obrigatória (mín. 5 caracteres)';
  END IF;

  SELECT nome, setor INTO v_nome, v_setor FROM public.employees WHERE id = v_lider.employee_id;
  v_modulo := public.normalizar_modulo_hora_extra(_modulo_origem, v_setor);

  INSERT INTO public.hora_extra_sabado (
    data, turno, horario_inicio, horario_fim, setor, modulo_origem,
    lider_id, tipo_convocacao, justificativa, observacao, status,
    created_by, aberto_por, aberto_por_nome, aberto_marcadores_em,
    criado_automatico, criado_automatico_por_nome
  ) VALUES (
    _data,
    COALESCE(NULLIF(btrim(_turno), ''), CASE WHEN _tipo='SABADO' THEN '1º' ELSE NULL END),
    _horario_inicio,
    _horario_fim,
    COALESCE(public.rotulo_modulo_hora_extra(v_modulo), v_setor),
    v_modulo,
    v_lider.id,
    _tipo,
    btrim(_justificativa),
    btrim(_justificativa),
    'PENDENTE',
    auth.uid(),
    auth.uid(),
    v_nome,
    now(),
    false,
    v_nome
  ) RETURNING id INTO v_id;

  IF _employee_ids IS NOT NULL AND array_length(_employee_ids, 1) > 0 THEN
    SELECT array_agg(x.id) INTO v_convocaveis
      FROM public.listar_convocaveis_lider(v_lider.id) x;

    FOREACH v_emp_id IN ARRAY _employee_ids LOOP
      IF v_convocaveis IS NULL OR NOT (v_emp_id = ANY(v_convocaveis)) THEN
        CONTINUE;
      END IF;

      SELECT nome, funcao INTO v_emp_nome, v_emp_funcao
        FROM public.employees
       WHERE id = v_emp_id;

      INSERT INTO public.hora_extra_sabado_funcionarios (
        hora_extra_id, employee_id, nome, externo, funcao,
        marcado_por, marcado_por_nome, marcado_em
      ) VALUES (
        v_id, v_emp_id, v_emp_nome, false, v_emp_funcao,
        auth.uid(), v_nome, now()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reenviar_hora_extra_modulo(_hora_extra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec record;
  v_modulo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_rec
    FROM public.hora_extra_sabado
   WHERE id = _hora_extra_id
   FOR UPDATE;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'Ficha de hora extra não encontrada';
  END IF;

  IF v_rec.status <> 'INDEFERIDA' THEN
    RAISE EXCEPTION 'Somente fichas indeferidas podem ser reenviadas';
  END IF;

  v_modulo := public.normalizar_modulo_hora_extra(v_rec.modulo_origem, v_rec.setor);

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR v_rec.created_by = v_uid
    OR EXISTS (
      SELECT 1
        FROM public.hora_extra_lideres l
       WHERE l.id = v_rec.lider_id
         AND l.user_id = v_uid
         AND l.ativo = true
    )
    OR EXISTS (
      SELECT 1
        FROM public.user_module_access uma
       WHERE uma.user_id = v_uid
         AND uma.enabled = true
         AND uma.module = v_modulo
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para reenviar esta ficha';
  END IF;

  UPDATE public.hora_extra_sabado
     SET status = 'PENDENTE',
         motivo_indeferimento = NULL,
         supervisor_id = NULL,
         supervisor_decisao_em = NULL,
         modulo_origem = v_modulo,
         updated_at = now()
   WHERE id = _hora_extra_id;
END;
$$;
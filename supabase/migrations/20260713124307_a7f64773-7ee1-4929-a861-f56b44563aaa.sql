DO $$
BEGIN
  -- Permite a nova janela usada pela convocação automática de exame de mudança de função.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'convocacoes_exames_janela_check'
      AND conrelid = 'public.convocacoes_exames'::regclass
  ) THEN
    ALTER TABLE public.convocacoes_exames
      DROP CONSTRAINT convocacoes_exames_janela_check;
  END IF;

  ALTER TABLE public.convocacoes_exames
    ADD CONSTRAINT convocacoes_exames_janela_check
    CHECK (janela = ANY (ARRAY[
      'VENCIDOS'::text,
      '30'::text,
      '60'::text,
      '90'::text,
      'TODOS'::text,
      'DEMISSIONAL'::text,
      'ADMISSIONAL'::text,
      'MUDANCA_FUNCAO'::text
    ]));

  -- Permite os tipos de auditoria emitidos pelo gatilho de funcionário.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_action_check'
      AND conrelid = 'public.audit_logs'::regclass
  ) THEN
    ALTER TABLE public.audit_logs
      DROP CONSTRAINT audit_logs_action_check;
  END IF;

  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_action_check
    CHECK (action = ANY (ARRAY[
      'INSERT'::text,
      'UPDATE'::text,
      'DELETE'::text,
      'READ'::text,
      'LOGIN'::text,
      'LOGOUT'::text,
      'RC_STATUS_CHANGE'::text,
      'RC_DISPENSA_COTACAO'::text,
      'RC_DISPENSA_REVOGADA'::text,
      'RC_DEVOLVIDA_PARA_COTACAO'::text,
      'REATIVAR_FUNCIONARIO'::text,
      'REBAIXAR_ADMIN'::text,
      'PURGE_INVITES'::text,
      'FORCE_SIGNOUT'::text,
      'MFA_ENROLL'::text,
      'MFA_UNENROLL'::text,
      'HARD_DELETE_EMPLOYEE'::text,
      'MUDANCA_CARGO'::text,
      'MUDANCA_GHE'::text
    ]));
END $$;

CREATE OR REPLACE FUNCTION public.tg_employee_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role_anterior_nome text;
  v_role_novo_nome text;
  v_ghe_anterior_nome text;
  v_ghe_novo_nome text;
  v_cursos_delta jsonb := '[]'::jsonb;
  v_qtd_delta int := 0;
  v_changed_by uuid;
  v_changed_by_email text;
  v_role_changed boolean;
  v_convocacao_id uuid;
BEGIN
  IF (NEW.role_id IS NOT DISTINCT FROM OLD.role_id)
     AND (NEW.ghe_id IS NOT DISTINCT FROM OLD.ghe_id) THEN
    RETURN NEW;
  END IF;

  v_changed_by := auth.uid();
  v_role_changed := (NEW.role_id IS DISTINCT FROM OLD.role_id);

  IF v_changed_by IS NOT NULL THEN
    SELECT u.email INTO v_changed_by_email
    FROM auth.users u
    WHERE u.id = v_changed_by;
  END IF;

  SELECT COALESCE(to_jsonb(r)->>'name', to_jsonb(r)->>'nome', OLD.role_id::text)
    INTO v_role_anterior_nome
    FROM public.roles r
   WHERE r.id = OLD.role_id;

  SELECT COALESCE(to_jsonb(r)->>'name', to_jsonb(r)->>'nome', NEW.role_id::text)
    INTO v_role_novo_nome
    FROM public.roles r
   WHERE r.id = NEW.role_id;

  SELECT 'GHE ' || COALESCE(g.numero::text,'?') || ' · ' || COALESCE(g.setor,'-')
    INTO v_ghe_anterior_nome
    FROM public.pgr_ghe g
   WHERE g.id = OLD.ghe_id;

  SELECT 'GHE ' || COALESCE(g.numero::text,'?') || ' · ' || COALESCE(g.setor,'-')
    INTO v_ghe_novo_nome
    FROM public.pgr_ghe g
   WHERE g.id = NEW.ghe_id;

  INSERT INTO public.employee_role_history (
    employee_id,
    role_id_anterior,
    role_id_novo,
    ghe_id_anterior,
    ghe_id_novo,
    motivo,
    changed_by,
    changed_at
  ) VALUES (
    NEW.id,
    OLD.role_id,
    NEW.role_id,
    OLD.ghe_id,
    NEW.ghe_id,
    CASE
      WHEN v_role_changed THEN 'Mudança cadastral de cargo/função'
      ELSE 'Mudança cadastral de GHE'
    END,
    v_changed_by,
    now()
  );

  IF NEW.role_id IS NOT NULL THEN
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'course_id', tmc.id,
        'course_name', COALESCE(to_jsonb(tmc)->>'nome', to_jsonb(tmc)->>'name', tmc.id::text)
      )), '[]'::jsonb),
      COUNT(*)::int
    INTO v_cursos_delta, v_qtd_delta
    FROM public.training_matrix_role_courses trc
    JOIN public.training_matrix_courses tmc ON tmc.id = trc.course_id
    WHERE trc.role_id = NEW.role_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.training_matrix_entries tme
        WHERE tme.employee_id = NEW.id
          AND tme.course_id = trc.course_id
          -- A coluna correta da tabela é data_realizacao; data_conclusao nunca existiu aqui.
          AND (
            tme.data_realizacao IS NOT NULL
            OR tme.status_override IN ('REALIZADO', 'NAO_SE_APLICA')
          )
      );
  END IF;

  IF v_role_changed
     AND NEW.role_id IS NOT NULL
     AND NEW.data_desligamento IS NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.convocacoes_exames
       WHERE employee_id = NEW.id
         AND status = 'PENDENTE'
         AND janela = 'MUDANCA_FUNCAO'
     ) THEN
    INSERT INTO public.convocacoes_exames (
      employee_id,
      janela,
      tipos_exame,
      convocado_por,
      data_limite,
      status,
      observacoes
    ) VALUES (
      NEW.id,
      'MUDANCA_FUNCAO',
      ARRAY['Exame Médico de Mudança de Função'],
      v_changed_by,
      CURRENT_DATE,
      'PENDENTE',
      'Convocação automática — mudança de cargo de "'
        || COALESCE(v_role_anterior_nome, '(sem cargo)')
        || '" para "' || COALESCE(v_role_novo_nome, '(sem cargo)')
        || '" em ' || to_char(now(), 'DD/MM/YYYY')
        || '. NR-07 7.5.1.II exige exame ANTES da mudança — regularizar imediatamente.'
    ) RETURNING id INTO v_convocacao_id;
  END IF;

  INSERT INTO public.audit_logs (
    table_name,
    action,
    record_id,
    user_id,
    user_email,
    old_data,
    new_data,
    created_at
  ) VALUES (
    'employees',
    CASE WHEN v_role_changed THEN 'MUDANCA_CARGO' ELSE 'MUDANCA_GHE' END,
    NEW.id,
    v_changed_by,
    v_changed_by_email,
    jsonb_build_object(
      'employee_nome', OLD.nome,
      'role_id', OLD.role_id,
      'role_nome', v_role_anterior_nome,
      'ghe_id', OLD.ghe_id,
      'ghe_nome', v_ghe_anterior_nome
    ),
    jsonb_build_object(
      'employee_nome', NEW.nome,
      'role_id', NEW.role_id,
      'role_nome', v_role_novo_nome,
      'ghe_id', NEW.ghe_id,
      'ghe_nome', v_ghe_novo_nome,
      'cursos_delta', v_cursos_delta,
      'qtd_cursos_pendentes', v_qtd_delta,
      'convocacao_mudanca_funcao_id', v_convocacao_id
    ),
    now()
  );

  RETURN NEW;
END;
$function$;
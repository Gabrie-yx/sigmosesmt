-- Ampliar CHECK de janela para aceitar convocações DEMISSIONAL e ADMISSIONAL
ALTER TABLE public.convocacoes_exames DROP CONSTRAINT IF EXISTS convocacoes_exames_janela_check;
ALTER TABLE public.convocacoes_exames
  ADD CONSTRAINT convocacoes_exames_janela_check
  CHECK (janela = ANY (ARRAY['VENCIDOS','30','60','90','TODOS','DEMISSIONAL','ADMISSIONAL']));

-- Corrigir função que gravava data no campo janela (deve gravar rótulo textual)
CREATE OR REPLACE FUNCTION public.gerar_convocacoes_aso_automaticas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criadas INT := 0;
  r RECORD;
  v_dias INT;
  v_janela TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (e.id)
      e.id AS employee_id,
      ex.data_vencimento
    FROM public.employees e
    JOIN public.employee_exams ex
      ON ex.employee_id = e.id
     AND ex.tipo_exame = 'ASO Clínico'
    WHERE e.data_desligamento IS NULL
      AND ex.data_vencimento IS NOT NULL
    ORDER BY e.id, ex.data_realizacao DESC NULLS LAST, ex.created_at DESC
  LOOP
    IF r.data_vencimento > CURRENT_DATE + INTERVAL '30 days' THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.convocacoes_exames WHERE employee_id = r.employee_id AND status = 'PENDENTE') THEN
      CONTINUE;
    END IF;
    v_dias := (r.data_vencimento - CURRENT_DATE);
    v_janela := CASE
      WHEN v_dias < 0 THEN 'VENCIDOS'
      WHEN v_dias <= 30 THEN '30'
      WHEN v_dias <= 60 THEN '60'
      ELSE '90'
    END;
    INSERT INTO public.convocacoes_exames (employee_id, janela, tipos_exame, status, data_limite, observacoes)
    VALUES (r.employee_id, v_janela, ARRAY['ASO Clínico'], 'PENDENTE', r.data_vencimento,
            'Gerada automaticamente pelo sistema (ASO vencendo em ' || to_char(r.data_vencimento, 'DD/MM/YYYY') || ')');
    v_criadas := v_criadas + 1;
  END LOOP;

  FOR r IN
    SELECT e.id AS employee_id, e.data_admissao
    FROM public.employees e
    WHERE e.data_desligamento IS NULL
      AND e.data_admissao IS NOT NULL
      AND e.data_admissao < CURRENT_DATE - INTERVAL '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.employee_exams ex WHERE ex.employee_id = e.id AND ex.tipo_exame = 'ASO Clínico')
      AND NOT EXISTS (SELECT 1 FROM public.convocacoes_exames c WHERE c.employee_id = e.id AND c.status = 'PENDENTE')
  LOOP
    INSERT INTO public.convocacoes_exames (employee_id, janela, tipos_exame, status, data_limite, observacoes)
    VALUES (r.employee_id, 'ADMISSIONAL', ARRAY['ASO Clínico'], 'PENDENTE', CURRENT_DATE + INTERVAL '15 days',
            'Gerada automaticamente pelo sistema (admissional pendente desde ' || to_char(r.data_admissao, 'DD/MM/YYYY') || ')');
    v_criadas := v_criadas + 1;
  END LOOP;

  IF v_criadas > 0 THEN
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES (NULL, 'aso_convocacao_automatica', 'convocacoes_exames', NULL,
              jsonb_build_object('criadas', v_criadas, 'executado_em', now()));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN v_criadas;
END;
$$;
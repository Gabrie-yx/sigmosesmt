-- Onda 2 · Item 2 — Convocação automática de ASO (cronjob diário)

CREATE OR REPLACE FUNCTION public.gerar_convocacoes_aso_automaticas()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criadas INT := 0;
  r RECORD;
BEGIN
  -- 1) ASO periódico vencido ou vencendo em ≤30 dias
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
    -- só se tá vencido ou vence em ≤30d
    IF r.data_vencimento > CURRENT_DATE + INTERVAL '30 days' THEN
      CONTINUE;
    END IF;

    -- já tem convocação PENDENTE aberta? pula
    IF EXISTS (
      SELECT 1 FROM public.convocacoes_exames
       WHERE employee_id = r.employee_id
         AND status = 'PENDENTE'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.convocacoes_exames (
      employee_id, janela, tipos_exame, status, data_limite, observacoes
    )
    VALUES (
      r.employee_id,
      r.data_vencimento,
      ARRAY['ASO Clínico'],
      'PENDENTE',
      r.data_vencimento,
      'Gerada automaticamente pelo sistema (ASO vencendo em ' || to_char(r.data_vencimento, 'DD/MM/YYYY') || ')'
    );
    v_criadas := v_criadas + 1;
  END LOOP;

  -- 2) Admissional pendente: admitido há >30d, nunca fez ASO, sem convocação PENDENTE
  FOR r IN
    SELECT e.id AS employee_id, e.data_admissao
    FROM public.employees e
    WHERE e.data_desligamento IS NULL
      AND e.data_admissao IS NOT NULL
      AND e.data_admissao < CURRENT_DATE - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.employee_exams ex
         WHERE ex.employee_id = e.id
           AND ex.tipo_exame = 'ASO Clínico'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.convocacoes_exames c
         WHERE c.employee_id = e.id
           AND c.status = 'PENDENTE'
      )
  LOOP
    INSERT INTO public.convocacoes_exames (
      employee_id, janela, tipos_exame, status, data_limite, observacoes
    )
    VALUES (
      r.employee_id,
      CURRENT_DATE,
      ARRAY['ASO Clínico'],
      'PENDENTE',
      CURRENT_DATE + INTERVAL '15 days',
      'Gerada automaticamente pelo sistema (admissional pendente desde ' || to_char(r.data_admissao, 'DD/MM/YYYY') || ')'
    );
    v_criadas := v_criadas + 1;
  END LOOP;

  -- log
  IF v_criadas > 0 THEN
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES (
        NULL,
        'aso_convocacao_automatica',
        'convocacoes_exames',
        NULL,
        jsonb_build_object('criadas', v_criadas, 'executado_em', now())
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN v_criadas;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerar_convocacoes_aso_automaticas() FROM anon, authenticated;

-- Agenda pra rodar todo dia às 06h (horário do servidor / UTC)
SELECT cron.unschedule('aso-convocacao-diaria')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='aso-convocacao-diaria');

SELECT cron.schedule(
  'aso-convocacao-diaria',
  '0 6 * * *',
  $$SELECT public.gerar_convocacoes_aso_automaticas();$$
);
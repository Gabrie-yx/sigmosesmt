
-- Hardening: revoga EXECUTE de PUBLIC/anon/authenticated em todas as funções SECURITY DEFINER do schema public,
-- então concede EXECUTE somente nas RPCs explicitamente chamadas pelo app.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- RPCs invocadas pelo app autenticado (mantém EXECUTE para authenticated)
GRANT EXECUTE ON FUNCTION public.peek_proximo_numero_apr()                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_saldo_epi(uuid, integer)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_epi(uuid, text, text, integer)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_epi(uuid, integer, tipo_movimentacao_epi, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_eficacia_acao(uuid, boolean, text)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dias_sem_acidente(uuid)                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.oss_marcar_vencidas()                                                TO authenticated;

-- Helpers de RLS / autorização — chamados internamente pelos policies; não precisam
-- ser invocáveis diretamente via PostgREST. Mantidas SEM grant para anon/authenticated.
-- (PostgreSQL ainda permite que policies as chamem porque elas rodam como SECURITY DEFINER
-- com privilégios do owner.)

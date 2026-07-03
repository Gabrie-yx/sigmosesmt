
-- =========================================================
-- 1) integracoes / integracao_participantes: restringir CUD
-- =========================================================
DROP POLICY IF EXISTS "auth write integracoes" ON public.integracoes;
DROP POLICY IF EXISTS "auth update integracoes" ON public.integracoes;
DROP POLICY IF EXISTS "auth delete integracoes" ON public.integracoes;

CREATE POLICY "integracoes_insert_editor" ON public.integracoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "integracoes_update_editor" ON public.integracoes
  FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "integracoes_delete_moderator" ON public.integracoes
  FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth write int part" ON public.integracao_participantes;
DROP POLICY IF EXISTS "auth update int part" ON public.integracao_participantes;
DROP POLICY IF EXISTS "auth delete int part" ON public.integracao_participantes;

CREATE POLICY "int_part_insert_editor" ON public.integracao_participantes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "int_part_update_editor" ON public.integracao_participantes
  FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "int_part_delete_moderator" ON public.integracao_participantes
  FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

-- =========================================================
-- 2) companies: SELECT restrito a visualizador ou superior
-- =========================================================
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select_viewer" ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

-- =========================================================
-- 3) contratada_documentos: SELECT restrito a viewer+
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can read contratada_documentos" ON public.contratada_documentos;
CREATE POLICY "contratada_documentos_select_viewer" ON public.contratada_documentos
  FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

-- =========================================================
-- 4) rc_cotacoes / rc_cotacao_itens: SELECT só Compras/Sup/Admin
-- =========================================================
DROP POLICY IF EXISTS "rc_cotacoes_select_all_auth" ON public.rc_cotacoes;
CREATE POLICY "rc_cotacoes_select_restrito" ON public.rc_cotacoes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.pode_gerenciar_compras(auth.uid())
    OR public.is_supervisor_geral(auth.uid())
  );

DROP POLICY IF EXISTS "rc_cotacao_itens_select" ON public.rc_cotacao_itens;
CREATE POLICY "rc_cotacao_itens_select_restrito" ON public.rc_cotacao_itens
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.pode_gerenciar_compras(auth.uid())
    OR public.is_supervisor_geral(auth.uid())
  );

-- =========================================================
-- 5) Storage: termos-consentimento — INSERT/UPDATE só editor
-- =========================================================
DROP POLICY IF EXISTS "Termos consentimento — upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Termos consentimento — update autenticado" ON storage.objects;

CREATE POLICY "Termos consentimento — upload editor" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'termos-consentimento' AND public.is_editor(auth.uid()));

CREATE POLICY "Termos consentimento — update editor" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'termos-consentimento' AND public.is_editor(auth.uid()))
  WITH CHECK (bucket_id = 'termos-consentimento' AND public.is_editor(auth.uid()));

-- =========================================================
-- 6) Storage: extintores-inspecoes — INSERT/SELECT com role
-- =========================================================
DROP POLICY IF EXISTS "auth envia fotos extintores-inspecoes" ON storage.objects;
DROP POLICY IF EXISTS "auth ve fotos extintores-inspecoes" ON storage.objects;

CREATE POLICY "extintores-inspecoes upload editor/tst" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'extintores-inspecoes'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'tst'::app_role)
      OR public.is_editor(auth.uid())
    )
  );

CREATE POLICY "extintores-inspecoes select viewer+" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'extintores-inspecoes'
    AND public.is_viewer_or_above(auth.uid())
  );

-- =========================================================
-- 7) View SECURITY DEFINER → security_invoker
-- =========================================================
ALTER VIEW public.v_termos_consentimento_status SET (security_invoker = true);

-- =========================================================
-- 8) REVOKE EXECUTE de anon nas funções SECURITY DEFINER
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.tg_acordo_log_criacao() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_employee_data_integracao() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_employee_termo_consentimento() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reativar_funcionario(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_geral(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_purchase_requisition_audit_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reabrir_rc(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.marcar_cotacao_vencedora(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.pode_gerenciar_compras(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dispensar_cotacoes_rc(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revogar_dispensa_rc(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enviar_rc_para_supervisor(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.devolver_rc_para_cotacao(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_read(text, uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalcular_valor_cotacao(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calcular_scores_rc(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.melhor_combo_por_item(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recalcular_cobertura_cotacao(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.arquivar_rc(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.desarquivar_rc(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancelar_os(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.extintor_apos_inspecao_foto() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fechar_convocacoes_ao_registrar_exame() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.marcar_convocacoes_vencidas() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.resolver_exames_funcionario(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_audit_fatores_consumo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.employee_exams_mudanca_risco() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.employee_exams_log_role_change() FROM anon, public;

-- =========================================================
-- 9) Fixar search_path das funções de trigger
-- =========================================================
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.trg_atualiza_valor_cotacao() SET search_path = public;
ALTER FUNCTION public.trg_rc_cotacoes_score() SET search_path = public;
ALTER FUNCTION public.trg_cobertura_cotacao() SET search_path = public;
ALTER FUNCTION public.trg_cotacao_recalcula_scores() SET search_path = public;

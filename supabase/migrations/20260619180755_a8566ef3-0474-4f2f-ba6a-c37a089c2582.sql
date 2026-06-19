-- Revoga EXECUTE público das funções SECURITY DEFINER internas (triggers e helpers)
-- Essas funções nunca devem ser chamadas diretamente pelo cliente
REVOKE EXECUTE ON FUNCTION public.gerar_numero_ria() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_apr() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_ordem_producao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_controle_doc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_tnc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_ppp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_extintor() FROM PUBLIC, anon, authenticated;

-- Triggers internos (nunca devem ser invocados via RPC)
REVOKE EXECUTE ON FUNCTION public.controle_doc_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ria_set_numero() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_apr_validade() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_numero_nc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.extintor_before_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.extintor_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_attendee_to_matrix() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_training_to_matrix() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.oss_emissoes_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plano_acoes_set_eficacia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plano_acoes_auto_origem() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pgr_inventario_set_classificacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pte_medicoes_calc_fora_limite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.employee_on_desligamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ppp_emissoes_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.controle_doc_log_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_nc_de_checklist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_fechar_nc_se_eficaz() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apr_risco_fill_passo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.oss_on_employee_cargo_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.oss_on_template_revision_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_employee_tipo_vinculo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_recorde_dias_sem_acidente() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_nc_de_acidente() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atestado_sync_override() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.oss_templates_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_employee_delete_with_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_pending_invite() FROM PUBLIC, anon, authenticated;

-- Garante service_role em tudo (interno do Postgres precisa)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Funções que PRECISAM continuar acessíveis ao app (re-grant explícito)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, app_module) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_viewer_or_above(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.requires_mfa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_ok() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_aal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_proximo_numero_apr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_saldo_epi(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_epi(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_epi(uuid, integer, tipo_movimentacao_epi, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_eficacia_acao(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_desligamento_funcionario(uuid, date, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reativar_funcionario(uuid) TO authenticated;
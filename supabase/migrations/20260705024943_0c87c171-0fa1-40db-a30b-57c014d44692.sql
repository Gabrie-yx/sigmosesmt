
-- =========================================================
-- BLINDAGEM DE AUDITORIA — snapshot completo em audit_logs
-- Registra INSERT/UPDATE/DELETE com payload integral (old_data/new_data)
-- Permite reconstrução de qualquer registro apagado no futuro
-- =========================================================

CREATE OR REPLACE FUNCTION public.fn_audit_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_record_id uuid;
BEGIN
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    BEGIN v_record_id := (to_jsonb(OLD)->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
    INSERT INTO public.audit_logs(table_name, action, record_id, user_id, user_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'DELETE', v_record_id, v_user_id, v_user_email, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN v_record_id := (to_jsonb(NEW)->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
    INSERT INTO public.audit_logs(table_name, action, record_id, user_id, user_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'UPDATE', v_record_id, v_user_id, v_user_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    BEGIN v_record_id := (to_jsonb(NEW)->>'id')::uuid; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
    INSERT INTO public.audit_logs(table_name, action, record_id, user_id, user_email, old_data, new_data)
    VALUES (TG_TABLE_NAME, 'INSERT', v_record_id, v_user_id, v_user_email, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Instalador idempotente por tabela
CREATE OR REPLACE FUNCTION public.fn_install_audit(_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_snapshot ON public.%I', _table);
  EXECUTE format(
    'CREATE TRIGGER trg_audit_snapshot
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_audit_snapshot()',
    _table
  );
END;
$$;

-- Aplicação nas tabelas críticas para SST/auditoria
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    -- Horas extras (o incidente)
    'hora_extra_sabado','hora_extra_sabado_funcionarios',
    'hora_extra_lideres','hora_extra_lider_escopo','hora_extra_marcadores',
    -- APR
    'aprs','apr_riscos','apr_assinaturas','apr_modelos',
    -- PT / PTE
    'ptes','pte_medicoes_atmosfericas',
    -- Extintores
    'extintores','extintor_inspecoes','extintor_inspecoes_fotos',
    -- ASO / Medicina
    'employee_atestados','employee_exams','employee_vaccinations',
    'convocacoes_exames','exam_catalog','exam_natureza_base','risco_exames',
    -- Colaboradores / cargos
    'employees','employee_docs','employee_role_history','employee_saidas_expediente',
    'roles','user_roles',
    -- Acidentes / incidentes / NC
    'acidentes_trabalho','relatorios_investigacao_acidente',
    'incidentes','incidente_evidencias',
    'nao_conformidades','plano_acoes',
    -- DDS / Treinamentos / Integração
    'dds','dds_attendees','dds_evidencias','dds_gestores','dds_temas',
    'trainings','training_attendees','training_anexos',
    'training_matrix_courses','training_matrix_entries',
    'training_matrix_role_courses','training_matrix_sector_courses',
    'integracoes','integracao_participantes',
    -- Checklists
    'checklist_modelos','checklist_modelo_secoes','checklist_modelo_itens',
    'checklist_execucoes','checklist_respostas','checklist_arquivos_legados',
    -- PGR
    'pgr_ghe','pgr_ghe_membros_override','pgr_inventario_riscos',
    'pgr_plano_acao','pgr_risco_epi',
    -- Cargos / riscos
    'cargo_riscos','cargo_riscos_medicoes',
    -- EPI / estoque
    'epi_deliveries','epi_fichas_mensais',
    'estoque_epi','estoque_epi_monthly_snapshots','historico_entregas',
    -- Documentos / procedimentos / OS
    'sesmt_documents','sesmt_document_revisions',
    'controle_documentos','controle_doc_anexos','controle_doc_categorias','controle_doc_recorrentes',
    'procedimentos','procedimento_revisoes','procedimento_cientes',
    'oss_emissoes','oss_templates',
    'documentos_assinados','assinaturas_salvas','assinaturas_termos_consentimento',
    'ppp_emissoes',
    -- Contratadas / fornecedores
    'contratada_documentos','contratada_acordos_adequacao',
    'empresas_terceiras','fornecedores','prestadores_saude',
    -- Compras / cotações
    'purchase_requisitions','purchase_requisition_items',
    'rc_cotacoes','rc_cotacao_itens',
    -- Companies / settings
    'companies','company_settings','company_frentes_servico',
    -- Equipamentos / cascos
    'equipamentos_moveis','cascos',
    -- Indicadores / recordes
    'dias_sem_acidente_recordes','hht_mensal',
    -- Overrides de segurança
    'safety_overrides'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      PERFORM public.fn_install_audit(t);
    END IF;
  END LOOP;
END $$;

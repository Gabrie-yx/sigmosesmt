-- ===== LGPD purge (CLOUD ONLY) =====

-- 1) Quebrar/limpar dependências que NÃO são ON DELETE CASCADE
UPDATE public.aprs SET tst_id = NULL, encarregado_id = NULL;
UPDATE public.cal_requisitos SET responsavel_id = NULL, gestor_area_id = NULL;
UPDATE public.cascos SET encarregado_id = NULL;
UPDATE public.cipa_gestoes SET presidente_id = NULL, vice_presidente_id = NULL, secretario_id = NULL, designado_employee_id = NULL;
UPDATE public.cipa_plano_anual SET responsavel_id = NULL;
UPDATE public.controle_doc_recorrentes SET responsavel_id = NULL;
UPDATE public.controle_documentos SET responsavel_id = NULL;
UPDATE public.integracoes SET instrutor_id = NULL;
UPDATE public.pte_medicoes_atmosfericas SET executor_id = NULL;
UPDATE public.portaria_visitas SET funcionario_recebedor_id = NULL;

DELETE FROM public.apr_assinaturas;
DELETE FROM public.acidentes_trabalho;
DELETE FROM public.relatorios_investigacao_acidente;
DELETE FROM public.incidente_evidencias;
DELETE FROM public.incidentes;
DELETE FROM public.hora_extra_marcadores;
ALTER TABLE public.hora_extra_sabado_funcionarios DISABLE TRIGGER trg_prevent_delete_hora_extra_sabado_funcionarios;
ALTER TABLE public.hora_extra_sabado DISABLE TRIGGER trg_prevent_delete_hora_extra_sabado;
DELETE FROM public.hora_extra_sabado_funcionarios;
DELETE FROM public.hora_extra_sabado;
ALTER TABLE public.hora_extra_sabado_funcionarios ENABLE TRIGGER trg_prevent_delete_hora_extra_sabado_funcionarios;
ALTER TABLE public.hora_extra_sabado ENABLE TRIGGER trg_prevent_delete_hora_extra_sabado;
DELETE FROM public.hora_extra_lider_escopo;
DELETE FROM public.ponto_tratativas;
DELETE FROM public.ponto_dias;
DELETE FROM public.ponto_folhas;
DELETE FROM public.ponto_ciclos;

-- 2) Portaria (dados pessoais de terceiros)
DELETE FROM public.portaria_visita_acompanhantes;
DELETE FROM public.portaria_saidas_funcionarios;
DELETE FROM public.portaria_visitas;
DELETE FROM public.portaria_veiculos;
DELETE FROM public.portaria_pessoas;
DELETE FROM public.portaria_fornecedores_recorrentes;
DELETE FROM public.portaria_auditoria;

-- 3) Psicossocial
DELETE FROM public.psico_respostas;
DELETE FROM public.psico_relatos_abertos;
DELETE FROM public.psico_denuncias;
DELETE FROM public.psico_consentimentos;
DELETE FROM public.psico_tokens;
DELETE FROM public.psico_assinatura_parecer;

-- 4) Assinaturas / biometria
DELETE FROM public.assinaturas_salvas;
DELETE FROM public.user_signatures;
DELETE FROM public.documentos_assinados;
DELETE FROM public.employee_vaccinations;
DELETE FROM public.dds_attendees;
DELETE FROM public.procedimento_cientes;

-- 5) Funcionários (cascata cobre exames, docs, EPI, ASO, OS, PPP, treinamentos...)
ALTER TABLE public.employees DISABLE TRIGGER trg_prevent_employee_delete_with_history;
DELETE FROM public.employees;
ALTER TABLE public.employees ENABLE TRIGGER trg_prevent_employee_delete_with_history;

-- 6) Arquivos do armazenamento são removidos via Storage API (fora desta migração).
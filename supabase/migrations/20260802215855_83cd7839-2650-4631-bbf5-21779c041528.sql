SET session_replication_role = replica;

DELETE FROM public.apr_assinaturas;
DELETE FROM public.apr_riscos;
DELETE FROM public.aprs;

DELETE FROM public.pte_medicoes_atmosfericas;
DELETE FROM public.ptes;

DELETE FROM public.inspecao_fotos;
DELETE FROM public.inspecao_nc_nrs_correlatas;
DELETE FROM public.inspecao_ncs_planos;
DELETE FROM public.inspecao_ncs;
DELETE FROM public.inspecoes;

DELETE FROM public.nao_conformidades;
DELETE FROM public.plano_acoes;

DELETE FROM public.relatorios_investigacao_acidente;
DELETE FROM public.incidente_evidencias;
DELETE FROM public.incidentes;
DELETE FROM public.acidentes_trabalho;

DELETE FROM public.ppp_emissoes;
DELETE FROM public.psico_denuncias;

DELETE FROM public.portaria_visita_acompanhantes;
DELETE FROM public.portaria_saidas_funcionarios;
DELETE FROM public.portaria_visitas;
DELETE FROM public.portaria_veiculos;
DELETE FROM public.portaria_fornecedores_recorrentes;

DELETE FROM public.integracao_participantes;
DELETE FROM public.integracoes;

DELETE FROM public.hora_extra_sabado_funcionarios;
DELETE FROM public.hora_extra_marcadores;
DELETE FROM public.hora_extra_sabado;
DELETE FROM public.hora_extra_lider_escopo;
DELETE FROM public.hora_extra_lideres;

DELETE FROM public.employee_company_history;
DELETE FROM public.employee_saidas_expediente;

DELETE FROM public.cascos;
DELETE FROM public.hht_mensal;
DELETE FROM public.dias_sem_acidente_recordes;
DELETE FROM public.contratada_acordos_historico;
DELETE FROM public.contratada_acordos_adequacao;
DELETE FROM public.contratada_documentos;
DELETE FROM public.company_frentes_servico;
DELETE FROM public.pcmso_coordenadores;
DELETE FROM public.cipa_membros;
DELETE FROM public.cipa_reunioes;
DELETE FROM public.cipa_plano_anual;
DELETE FROM public.cipa_calendario_eleicao;
DELETE FROM public.cipa_gestoes;

DELETE FROM public.companies;

SET session_replication_role = origin;
-- Limpar linhas de "Plano de Ação" (PA*) que entraram por engano na tabela de requisitos
DELETE FROM public.cal_historico WHERE requisito_id IN (SELECT id FROM public.cal_requisitos WHERE numero_cal LIKE 'PA%');
DELETE FROM public.cal_normas_vinculadas WHERE requisito_id IN (SELECT id FROM public.cal_requisitos WHERE numero_cal LIKE 'PA%');
DELETE FROM public.cal_planos_acao WHERE requisito_id IN (SELECT id FROM public.cal_requisitos WHERE numero_cal LIKE 'PA%');
DELETE FROM public.cal_requisitos WHERE numero_cal LIKE 'PA%';
-- Também limpa os lotes anteriores que ficaram órfãos (arquivo Plano de Ação)
DELETE FROM public.cal_lote_importacao WHERE nome_arquivo ILIKE 'Plano%';
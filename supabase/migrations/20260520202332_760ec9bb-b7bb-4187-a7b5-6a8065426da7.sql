INSERT INTO public.producao_ordens (numero, data_solicitacao, casco, tipo_produto, solicitante, mtart, status)
VALUES
 (public.gerar_numero_ordem_producao(), CURRENT_DATE, 'CASCO 134', 'BALSA (Casco em construção)', 'ANDERSON SOARES', 'HALB', 'RASCUNHO'),
 (public.gerar_numero_ordem_producao(), CURRENT_DATE, 'CASCO 135', 'BALSA (Casco em construção)', 'ANDERSON SOARES', 'HALB', 'RASCUNHO'),
 (public.gerar_numero_ordem_producao(), CURRENT_DATE, 'CASCO 136', 'BALSA (Casco em construção)', 'ANDERSON SOARES', 'HALB', 'RASCUNHO'),
 (public.gerar_numero_ordem_producao(), CURRENT_DATE, 'CASCO 137', 'BALSA (Casco em construção)', 'ANDERSON SOARES', 'HALB', 'RASCUNHO');
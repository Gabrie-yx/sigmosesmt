INSERT INTO public.producao_mb51_ordens (numero_sap, texto_documento, casco_id)
VALUES
 ('PEND-CASCO-134', 'CASCO 134 — aguardando MB51', 'd29de999-a925-4463-ad53-c785941d8dce'),
 ('PEND-CASCO-135', 'CASCO 135 — aguardando MB51', '63014444-e03a-4e31-a577-4c8ae5a86eda'),
 ('PEND-CASCO-136', 'CASCO 136 — aguardando MB51', 'e2f9ddea-baa3-4014-a3c9-3b203e062399'),
 ('PEND-CASCO-137', 'CASCO 137 — aguardando MB51', '74e61d42-5ed5-4a91-8bf6-3a2281d40beb')
ON CONFLICT DO NOTHING;
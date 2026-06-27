-- Remove cargo duplicado "TÉCNICO EM SEGURANÇA DO TRABALHO" (todo em maiúsculas, sem funcionários)
DELETE FROM public.cargo_riscos WHERE role_id = '38ed0461-71ee-47f6-8ad7-2c2c4a3ebc6e';
DELETE FROM public.roles WHERE id = '38ed0461-71ee-47f6-8ad7-2c2c4a3ebc6e';
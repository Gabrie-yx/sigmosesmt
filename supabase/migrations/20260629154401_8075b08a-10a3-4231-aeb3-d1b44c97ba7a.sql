UPDATE public.employees
SET tipo_cadastro = 'AVULSO'
WHERE tipo_cadastro = 'MEI'
  AND (cnpj IS NULL OR btrim(cnpj) = '');
-- Reclassificar tipo_cadastro: TERCEIRIZADO deixa de ser vínculo (vai pelo tipo da empresa)
-- 1) Quem estava como TERCEIRIZADO e tem CNPJ -> MEI
UPDATE public.employees
   SET tipo_cadastro = 'MEI'
 WHERE upper(coalesce(tipo_cadastro,'')) = 'TERCEIRIZADO'
   AND cnpj IS NOT NULL AND btrim(cnpj) <> '';

-- 2) Quem estava como TERCEIRIZADO sem CNPJ -> AVULSO
UPDATE public.employees
   SET tipo_cadastro = 'AVULSO'
 WHERE upper(coalesce(tipo_cadastro,'')) = 'TERCEIRIZADO';

-- 3) Funcionários lotados em empresa TERCEIRIZADA sem CNPJ informado
--    e que ainda não estão como MEI/AVULSO -> AVULSO
UPDATE public.employees e
   SET tipo_cadastro = 'AVULSO'
  FROM public.companies c
 WHERE e.company_id = c.id
   AND c.type = 'TERCEIRIZADO'
   AND (e.cnpj IS NULL OR btrim(e.cnpj) = '')
   AND upper(coalesce(e.tipo_cadastro,'')) NOT IN ('MEI','AVULSO');

-- 4) Funcionários em empresa TERCEIRIZADA COM CNPJ -> MEI (se não estiver)
UPDATE public.employees e
   SET tipo_cadastro = 'MEI'
  FROM public.companies c
 WHERE e.company_id = c.id
   AND c.type = 'TERCEIRIZADO'
   AND e.cnpj IS NOT NULL AND btrim(e.cnpj) <> ''
   AND upper(coalesce(e.tipo_cadastro,'')) NOT IN ('MEI','AVULSO');
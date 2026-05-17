
-- 1) Remove cadastro errado de ROMILSON na DMN
DELETE FROM public.employees WHERE id = '82b3383e-7a79-4781-b151-dc28038d6b15';

-- 2) Corrige o cadastro na NB CONSTRUÇÃO (nome + função encarregado)
UPDATE public.employees
   SET nome = 'ROMILSON REGES DE OLIVEIRA',
       role_id = 'b1172d54-9bed-4734-9e5b-114399077953'
 WHERE id = '1079e16e-b931-4bc7-9b23-a54e15ffd89c';

-- 3) Adiciona NR-35 às funções de montagem que estavam sem
UPDATE public.roles
   SET req_nrs = (
     SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(req_nrs, ARRAY[]::text[]) || ARRAY['NR-35']::text[]))
   )
 WHERE id IN (
   '9ac7de94-f882-4f56-8d0d-b411fab369aa', -- Montador I
   '196d3344-d6ba-4374-bf52-d2431631da09', -- Montador II
   'c38c7e3a-72e3-461f-a0ac-3fe373aa5dda'  -- Encarregado de Produção/Montagem
 );

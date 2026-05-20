DELETE FROM public.producao_base_materia_prima 
WHERE tipo = 'OUTROS' 
  AND created_at::date = CURRENT_DATE
  AND codigo IN ('30000898','30003992','40000234','40000236','40000239','40000240');
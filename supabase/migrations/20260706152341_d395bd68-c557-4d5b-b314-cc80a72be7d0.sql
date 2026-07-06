UPDATE public.ponto_dias
SET precisa_tratativa = false
WHERE precisa_tratativa = true
  AND (motivo_flag IS NULL OR motivo_flag NOT IN ('FALTA', 'ATRASO'));
ALTER TABLE public.epi_deliveries
  ADD COLUMN IF NOT EXISTS assinatura_snapshot text,
  ADD COLUMN IF NOT EXISTS assinatura_data timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_responsavel_nome text,
  ADD COLUMN IF NOT EXISTS assinatura_responsavel_cargo text;

COMMENT ON COLUMN public.epi_deliveries.assinatura_snapshot IS 'PNG data URL da assinatura do funcionário coletada no ato da entrega (NR-06 item 6.7)';
COMMENT ON COLUMN public.epi_deliveries.assinatura_data IS 'Timestamp em que a assinatura foi coletada (pode ser posterior à data_entrega se retroativa)';
-- Snapshots mensais de estoque inicial dos EPIs
CREATE TABLE public.estoque_epi_monthly_snapshots (
  epi_id uuid NOT NULL REFERENCES public.estoque_epi(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  estoque_inicial int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epi_id, year, month)
);

ALTER TABLE public.estoque_epi_monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY estoque_snapshots_select ON public.estoque_epi_monthly_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY estoque_snapshots_insert ON public.estoque_epi_monthly_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY estoque_snapshots_update ON public.estoque_epi_monthly_snapshots
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));

CREATE POLICY estoque_snapshots_delete ON public.estoque_epi_monthly_snapshots
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Função que gera os snapshots do mês corrente para todos os EPIs
CREATE OR REPLACE FUNCTION public.snapshot_estoque_epi_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  int := EXTRACT(year  FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_month int := EXTRACT(month FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
BEGIN
  INSERT INTO public.estoque_epi_monthly_snapshots (epi_id, year, month, estoque_inicial)
  SELECT id, v_year, v_month, COALESCE(quantidade_atual, 0)
  FROM public.estoque_epi
  ON CONFLICT (epi_id, year, month) DO NOTHING;
END;
$$;

-- Seed: garante snapshot para o mês corrente já existente
SELECT public.snapshot_estoque_epi_monthly();

-- Agenda execução automática no dia 1º de cada mês às 00:05 (UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-estoque-epi-monthly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-estoque-epi-monthly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'snapshot-estoque-epi-monthly',
  '5 3 1 * *', -- 03:05 UTC ≈ 00:05 America/Sao_Paulo
  $$SELECT public.snapshot_estoque_epi_monthly();$$
);
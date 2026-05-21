CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='controle-doc-gerar-recorrentes-diario') THEN
    PERFORM cron.unschedule('controle-doc-gerar-recorrentes-diario');
  END IF;
END $$;

SELECT cron.schedule(
  'controle-doc-gerar-recorrentes-diario',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4c16feea-38ca-4c93-8357-2c520346a279.lovable.app/api/public/controle-documentos/gerar-recorrentes',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1va3VpdG9jYWlocGd0bGdscnRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjc5OTYsImV4cCI6MjA5MjkwMzk5Nn0.rTZsC23QkQ4Xrq910UNLMCLsOW-jXPHlHHek5X2my_s"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
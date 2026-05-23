CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- pg_net não aceita SET SCHEMA — recriar
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- Reagenda o cron com o novo schema
SELECT cron.unschedule('controle-doc-gerar-recorrentes-diario');
SELECT cron.schedule(
  'controle-doc-gerar-recorrentes-diario',
  '0 9 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://project--4c16feea-38ca-4c93-8357-2c520346a279.lovable.app/api/public/controle-documentos/gerar-recorrentes',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1va3VpdG9jYWlocGd0bGdscnRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjc5OTYsImV4cCI6MjA5MjkwMzk5Nn0.rTZsC23QkQ4Xrq910UNLMCLsOW-jXPHlHHek5X2my_s"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
-- Remove a constraint UNIQUE em oss_templates.cargo para permitir múltiplos templates por cargo
-- (ex: revisões antigas inativas + novo template ativo convivendo)
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.oss_templates'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(cargo)%'
  LOOP
    EXECUTE format('ALTER TABLE public.oss_templates DROP CONSTRAINT %I', v_conname);
  END LOOP;
END$$;

-- Remove índices únicos no cargo, se existirem
DO $$
DECLARE
  v_idx TEXT;
BEGIN
  FOR v_idx IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'oss_templates'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(cargo)%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', v_idx);
  END LOOP;
END$$;
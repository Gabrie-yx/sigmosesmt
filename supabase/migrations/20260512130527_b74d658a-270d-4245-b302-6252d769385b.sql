ALTER TABLE public.dds
  ADD COLUMN IF NOT EXISTS temas_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS temas_livres text[] NOT NULL DEFAULT '{}';

-- Backfill from legacy single-value columns
UPDATE public.dds
   SET temas_ids = ARRAY[tema_id]
 WHERE tema_id IS NOT NULL AND (temas_ids IS NULL OR array_length(temas_ids,1) IS NULL);

UPDATE public.dds
   SET temas_livres = ARRAY[tema_livre]
 WHERE tema_livre IS NOT NULL AND tema_livre <> '' AND (temas_livres IS NULL OR array_length(temas_livres,1) IS NULL);
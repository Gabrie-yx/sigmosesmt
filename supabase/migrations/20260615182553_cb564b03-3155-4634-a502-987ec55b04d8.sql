
ALTER TABLE public.ptes
  ADD COLUMN IF NOT EXISTS requisitante_id uuid,
  ADD COLUMN IF NOT EXISTS executantes_ids uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS vigia_id uuid,
  ADD COLUMN IF NOT EXISTS supervisor_entrada_id uuid,
  ADD COLUMN IF NOT EXISTS emitente_user_id uuid;

CREATE INDEX IF NOT EXISTS ptes_requisitante_idx ON public.ptes (requisitante_id);
CREATE INDEX IF NOT EXISTS ptes_vigia_idx ON public.ptes (vigia_id);

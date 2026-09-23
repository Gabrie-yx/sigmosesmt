ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS epis jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.roles.epis IS
  'EPIs obrigatorios do cargo no formato [{"nome": "...", "ca": "..."}]';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

NOTIFY pgrst, 'reload schema';
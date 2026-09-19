CREATE TABLE IF NOT EXISTS public.empresa_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ramo text,
  rotulos jsonb NOT NULL DEFAULT '{}'::jsonb,
  modulos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_config_company_uniq ON public.empresa_config (company_id) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS empresa_config_global_uniq ON public.empresa_config ((company_id IS NULL)) WHERE company_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_config TO authenticated;
GRANT ALL ON public.empresa_config TO service_role;

ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_config_select" ON public.empresa_config;
CREATE POLICY "empresa_config_select" ON public.empresa_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "empresa_config_insert" ON public.empresa_config;
CREATE POLICY "empresa_config_insert" ON public.empresa_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "empresa_config_update" ON public.empresa_config;
CREATE POLICY "empresa_config_update" ON public.empresa_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "empresa_config_delete" ON public.empresa_config;
CREATE POLICY "empresa_config_delete" ON public.empresa_config
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.empresa_config_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_config_touch_trg ON public.empresa_config;
CREATE TRIGGER empresa_config_touch_trg BEFORE UPDATE ON public.empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.empresa_config_touch();

INSERT INTO public.empresa_config (company_id, ramo, rotulos, modulos)
SELECT NULL, NULL, '{}'::jsonb, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.empresa_config WHERE company_id IS NULL);
CREATE TABLE IF NOT EXISTS public.temp_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.temp_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY temp_admins_select ON public.temp_admins
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY temp_admins_insert ON public.temp_admins
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY temp_admins_delete ON public.temp_admins
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
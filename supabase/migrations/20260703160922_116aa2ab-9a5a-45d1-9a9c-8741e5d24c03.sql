ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'compras';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compras';

CREATE OR REPLACE FUNCTION public.pode_gerenciar_compras(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'compras'::public.app_role)
    OR public.is_supervisor_geral(_user_id)
    OR (
      public.has_module_access(_user_id, 'compras'::public.app_module)
      AND (
        public.has_role(_user_id, 'editor'::public.app_role)
        OR public.has_role(_user_id, 'moderador'::public.app_role)
      )
    );
$$;
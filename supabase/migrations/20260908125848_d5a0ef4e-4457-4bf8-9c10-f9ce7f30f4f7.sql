
CREATE OR REPLACE FUNCTION public.is_almoxarife(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_module_access
        WHERE user_id = _user_id
          AND enabled = true
          AND module IN ('almoxarifado'::public.app_module, 'estoque'::public.app_module)
      );
$$;

-- leitura: quem tem qualquer módulo liberado conta como viewer
CREATE OR REPLACE FUNCTION public.is_viewer_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_module_access
        WHERE user_id = _user_id AND enabled = true
      );
$$;

-- almoxarifado pode registrar entrega de EPI
DROP POLICY IF EXISTS epi_deliveries_insert ON public.epi_deliveries;
CREATE POLICY epi_deliveries_insert ON public.epi_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()) OR public.is_almoxarife(auth.uid()));

DROP POLICY IF EXISTS epi_deliveries_update ON public.epi_deliveries;
CREATE POLICY epi_deliveries_update ON public.epi_deliveries
  FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()) OR public.is_almoxarife(auth.uid()));

DROP POLICY IF EXISTS historico_entregas_insert ON public.historico_entregas;
CREATE POLICY historico_entregas_insert ON public.historico_entregas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()) OR public.is_almoxarife(auth.uid()));

DROP POLICY IF EXISTS estoque_epi_update ON public.estoque_epi;
CREATE POLICY estoque_epi_update ON public.estoque_epi
  FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()) OR public.is_almoxarife(auth.uid()));

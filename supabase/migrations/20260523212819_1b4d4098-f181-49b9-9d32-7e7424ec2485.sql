
-- Restringir UPDATE/DELETE/INSERT em incidentes, nao_conformidades, plano_acoes
-- Antes: qualquer logado mexia em tudo
-- Depois: só criador (created_by) OU admin/moderador

-- ===== INCIDENTES =====
DROP POLICY IF EXISTS auth_insert_incidentes ON public.incidentes;
DROP POLICY IF EXISTS auth_update_incidentes ON public.incidentes;
DROP POLICY IF EXISTS auth_delete_incidentes ON public.incidentes;

CREATE POLICY "insert_incidentes_logged"
  ON public.incidentes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "update_incidentes_owner_or_mod"
  ON public.incidentes FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_moderator(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_moderator(auth.uid()));

CREATE POLICY "delete_incidentes_owner_or_mod"
  ON public.incidentes FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_moderator(auth.uid()));

-- ===== NAO_CONFORMIDADES =====
DROP POLICY IF EXISTS auth_insert_nao_conformidades ON public.nao_conformidades;
DROP POLICY IF EXISTS auth_update_nao_conformidades ON public.nao_conformidades;
DROP POLICY IF EXISTS auth_delete_nao_conformidades ON public.nao_conformidades;

CREATE POLICY "insert_nc_logged"
  ON public.nao_conformidades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "update_nc_owner_resp_or_mod"
  ON public.nao_conformidades FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = responsavel_id OR public.is_moderator(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR auth.uid() = responsavel_id OR public.is_moderator(auth.uid()));

CREATE POLICY "delete_nc_owner_or_mod"
  ON public.nao_conformidades FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_moderator(auth.uid()));

-- ===== PLANO_ACOES =====
DROP POLICY IF EXISTS auth_insert_plano_acoes ON public.plano_acoes;
DROP POLICY IF EXISTS auth_update_plano_acoes ON public.plano_acoes;
DROP POLICY IF EXISTS auth_delete_plano_acoes ON public.plano_acoes;

CREATE POLICY "insert_plano_acoes_logged"
  ON public.plano_acoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "update_plano_acoes_owner_resp_or_mod"
  ON public.plano_acoes FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = responsavel_id OR public.is_moderator(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR auth.uid() = responsavel_id OR public.is_moderator(auth.uid()));

CREATE POLICY "delete_plano_acoes_owner_or_mod"
  ON public.plano_acoes FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_moderator(auth.uid()));

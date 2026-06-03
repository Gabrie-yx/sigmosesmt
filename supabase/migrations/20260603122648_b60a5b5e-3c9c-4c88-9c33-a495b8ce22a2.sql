-- Restringir leitura de papéis de usuário
DROP POLICY IF EXISTS user_roles_select_authed ON public.user_roles;
CREATE POLICY user_roles_select_own_or_admin
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.mfa_ok())
);

-- Restringir leitura de dados pessoais e tokens operacionais a usuários com perfil/role no sistema
DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select_viewer_or_above
ON public.employees
FOR SELECT
TO authenticated
USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS historico_entregas_select ON public.historico_entregas;
CREATE POLICY historico_entregas_select_viewer_or_above
ON public.historico_entregas
FOR SELECT
TO authenticated
USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS apr_assin_select ON public.apr_assinaturas;
CREATE POLICY apr_assin_select_viewer_or_above
ON public.apr_assinaturas
FOR SELECT
TO authenticated
USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS pr_select ON public.purchase_requisitions;
CREATE POLICY pr_select_viewer_or_above
ON public.purchase_requisitions
FOR SELECT
TO authenticated
USING (public.is_viewer_or_above(auth.uid()));

-- Auditoria e controle de abuso para cotações via link público
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS cotacao_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cotacao_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS cotacao_submitter_ip text,
  ADD COLUMN IF NOT EXISTS cotacao_user_agent text,
  ADD COLUMN IF NOT EXISTS cotacao_submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS purchase_requisitions_cotacao_attempt_idx
ON public.purchase_requisitions (status_token, cotacao_attempt_count, cotacao_last_attempt_at);
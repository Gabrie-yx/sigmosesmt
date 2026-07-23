DROP POLICY IF EXISTS "editores leem pacotes" ON public.desligamento_pacotes;

CREATE POLICY "usuarios autorizados leem pacotes emitidos"
ON public.desligamento_pacotes
FOR SELECT
TO authenticated
USING (
  public.is_viewer_or_above(auth.uid())
  AND status = 'EMITIDO'
);

CREATE POLICY "editores leem rascunhos de pacotes"
ON public.desligamento_pacotes
FOR SELECT
TO authenticated
USING (
  public.is_editor(auth.uid())
  AND status <> 'EMITIDO'
);
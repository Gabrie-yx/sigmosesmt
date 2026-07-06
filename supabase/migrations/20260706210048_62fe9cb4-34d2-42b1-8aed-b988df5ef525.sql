CREATE POLICY "criador pode excluir hora_extra pendente ou indeferida"
ON public.hora_extra_sabado
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND status IN ('PENDENTE','INDEFERIDA')
);
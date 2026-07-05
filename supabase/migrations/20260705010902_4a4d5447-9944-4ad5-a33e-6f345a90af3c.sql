
-- Apaga registros retroativos de hora extra (serão descartados; só valem os novos)
DELETE FROM public.hora_extra_sabado_funcionarios;
DELETE FROM public.hora_extra_sabado;

-- Permite que o Supervisor de Produção (usuário do módulo Administrativo) aprove/indefere
CREATE OR REPLACE FUNCTION public.decidir_convocacao_extra(
  _hora_extra_id uuid,
  _aprovar boolean,
  _motivo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'supervisor_extra_geral')
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_module_access
      WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para decidir convocações de hora extra';
  END IF;

  IF NOT _aprovar AND (_motivo IS NULL OR length(btrim(_motivo)) < 5) THEN
    RAISE EXCEPTION 'Motivo de indeferimento é obrigatório (mín. 5 caracteres)';
  END IF;

  UPDATE public.hora_extra_sabado
     SET status = CASE WHEN _aprovar THEN 'APROVADA' ELSE 'INDEFERIDA' END,
         supervisor_id = auth.uid(),
         supervisor_decisao_em = now(),
         motivo_indeferimento = CASE WHEN _aprovar THEN NULL ELSE btrim(_motivo) END,
         updated_at = now()
   WHERE id = _hora_extra_id;
END;
$$;

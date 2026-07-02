-- Add reactivation audit columns
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS motivo_reativacao text,
  ADD COLUMN IF NOT EXISTS data_reativacao date,
  ADD COLUMN IF NOT EXISTS reativado_por uuid;

-- Update reativar_funcionario RPC to accept justification
CREATE OR REPLACE FUNCTION public.reativar_funcionario(
  _employee_id uuid,
  _motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 5 caracteres) para reativação';
  END IF;

  UPDATE public.employees
     SET status = 'ATIVO',
         motivo_reativacao = _motivo,
         data_reativacao = CURRENT_DATE,
         reativado_por = auth.uid(),
         updated_at = now()
   WHERE id = _employee_id;

  -- Revoga overrides globais criados automaticamente pelo desligamento
  UPDATE public.safety_overrides
     SET ativo = false,
         revogado_por = auth.uid(),
         revogado_em = now(),
         motivo_revogacao = 'Reativação: ' || _motivo
   WHERE employee_id = _employee_id
     AND ativo = true
     AND scope = 'GLOBAL';

  -- Registra na audit_logs se existir
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (auth.uid(), 'REATIVAR_FUNCIONARIO', 'employees', _employee_id,
            jsonb_build_object('motivo', _motivo, 'data', CURRENT_DATE));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;
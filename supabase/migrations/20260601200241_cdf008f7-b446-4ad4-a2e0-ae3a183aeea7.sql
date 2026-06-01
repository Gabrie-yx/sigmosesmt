-- Corrigir trigger: employees usa role_id, não cargo
CREATE OR REPLACE FUNCTION public.oss_on_employee_cargo_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    UPDATE public.oss_emissoes
       SET status = 'SUBSTITUIDO', updated_at = now()
     WHERE employee_id = NEW.id
       AND status IN ('PENDENTE_ASSINATURA', 'ASSINADO');
  END IF;
  RETURN NEW;
END;
$$;
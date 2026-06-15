CREATE UNIQUE INDEX IF NOT EXISTS employees_cpf_digits_unique
ON public.employees ((regexp_replace(coalesce(cpf, ''), '\D', '', 'g')))
WHERE nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_employee_delete_with_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf_digits text := regexp_replace(coalesce(OLD.cpf, ''), '\D', '', 'g');
  v_has_history boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.epi_deliveries WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_exams WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_docs WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_atestados WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_vaccinations WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_saidas_expediente WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.training_attendees WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.training_matrix_entries WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.dds_attendees WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.apr_assinaturas WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.oss_emissoes WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.ppp_emissoes WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.documentos_assinados WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.historico_entregas
      WHERE v_cpf_digits <> ''
        AND regexp_replace(coalesce(cpf_colaborador, ''), '\D', '', 'g') = v_cpf_digits
    LIMIT 1
  ) INTO v_has_history;

  IF v_has_history THEN
    RAISE EXCEPTION 'Funcionário possui histórico vinculado e não pode ser excluído. Altere o status para INATIVO quando necessário.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_employee_delete_with_history ON public.employees;
CREATE TRIGGER trg_prevent_employee_delete_with_history
BEFORE DELETE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.prevent_employee_delete_with_history();
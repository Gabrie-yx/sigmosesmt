DELETE FROM public.training_matrix_entries e
WHERE e.status_override = 'NAO_SE_APLICA'
  AND NOT EXISTS (
    SELECT 1 FROM public.employees emp
    JOIN public.training_matrix_role_courses rc
      ON rc.role_id = emp.role_id AND rc.course_id = e.course_id
    WHERE emp.id = e.employee_id
  );
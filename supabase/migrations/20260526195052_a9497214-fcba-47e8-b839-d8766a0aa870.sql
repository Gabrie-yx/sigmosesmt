DELETE FROM public.training_matrix_role_courses
WHERE role_id IN (SELECT id FROM public.roles WHERE name ILIKE 'Auxiliar de Montagem')
  AND course_id IN (SELECT id FROM public.training_matrix_courses WHERE codigo ILIKE 'NR-12' OR codigo ILIKE 'NR12');
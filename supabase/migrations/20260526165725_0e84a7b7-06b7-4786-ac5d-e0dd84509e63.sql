-- Remove NR-05 (CIPA) de todos os cargos: CIPA é por designação, não por função.
DELETE FROM public.training_matrix_role_courses
WHERE course_id IN (SELECT id FROM public.training_matrix_courses WHERE codigo = 'NR-05');

-- Remove NR-33 (Espaço Confinado) do cargo "Auxiliar de Montagem":
-- a função não acessa porão/tanque na operação atual da DMN.
DELETE FROM public.training_matrix_role_courses
WHERE course_id = (SELECT id FROM public.training_matrix_courses WHERE codigo = 'NR-33')
  AND role_id IN (SELECT id FROM public.roles WHERE name = 'Auxiliar de Montagem');
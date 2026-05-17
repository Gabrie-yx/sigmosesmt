
DELETE FROM public.training_matrix_sector_courses
WHERE setor = 'ALMOXARIFADO'
  AND course_id IN (
    SELECT id FROM public.training_matrix_courses
    WHERE codigo IN ('NR-05','NR-07','NR-10','NR-10-SEP','NR-12','NR-20','NR-23','NR-33','NR-34','NR-35')
  );

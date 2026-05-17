DELETE FROM public.training_matrix_role_courses rc
USING public.training_matrix_courses c, public.roles r
WHERE rc.course_id = c.id
  AND rc.role_id = r.id
  AND c.codigo = 'NR-35'
  AND NOT (COALESCE(r.req_nrs, ARRAY[]::text[]) @> ARRAY['NR-35']::text[]);
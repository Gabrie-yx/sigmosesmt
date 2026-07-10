DO $$
DECLARE
  canonical_id uuid;
  duplicate_id uuid;
BEGIN
  SELECT id INTO canonical_id FROM public.catalogo_riscos WHERE nome = 'Calor (IBUTG)' LIMIT 1;
  SELECT id INTO duplicate_id FROM public.catalogo_riscos WHERE nome = 'Calor' LIMIT 1;

  IF canonical_id IS NOT NULL AND duplicate_id IS NOT NULL AND canonical_id <> duplicate_id THEN
    UPDATE public.cargo_riscos cr
       SET risco_id = canonical_id
     WHERE cr.risco_id = duplicate_id
       AND NOT EXISTS (
         SELECT 1 FROM public.cargo_riscos cr2
          WHERE cr2.role_id = cr.role_id AND cr2.risco_id = canonical_id
       );
    DELETE FROM public.cargo_riscos WHERE risco_id = duplicate_id;

    UPDATE public.risco_exames re
       SET risco_id = canonical_id
     WHERE re.risco_id = duplicate_id
       AND NOT EXISTS (
         SELECT 1 FROM public.risco_exames re2
          WHERE re2.exam_id = re.exam_id AND re2.risco_id = canonical_id
       );
    DELETE FROM public.risco_exames WHERE risco_id = duplicate_id;

    DELETE FROM public.catalogo_riscos WHERE id = duplicate_id;
  END IF;
END $$;
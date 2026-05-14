-- Apaga funcionários duplicados (antigos, sem matrícula/setor, sem lançamentos de matriz)
-- mantendo o registro novo (com matrícula e setor) para a mesma pessoa/empresa.
DELETE FROM public.employees e
WHERE e.matricula IS NULL
  AND e.setor IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.training_matrix_entries t WHERE t.employee_id = e.id)
  AND EXISTS (
    SELECT 1 FROM public.employees e2
    WHERE e2.id <> e.id
      AND e2.nome = e.nome
      AND COALESCE(e2.company_id::text,'') = COALESCE(e.company_id::text,'')
      AND e2.matricula IS NOT NULL
  );
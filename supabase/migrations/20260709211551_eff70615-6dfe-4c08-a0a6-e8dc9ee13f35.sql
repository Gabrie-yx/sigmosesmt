
DO $$
DECLARE
  merges record;
BEGIN
  FOR merges IN
    SELECT * FROM (VALUES
      ('b64e2a51-378c-4cff-81ea-1a03e2a65917'::uuid, '63e68ad2-58b7-46b2-b028-f239c6df4e74'::uuid),
      ('b64e2a51-378c-4cff-81ea-1a03e2a65917'::uuid, '6cb3f013-3598-42eb-aabb-b16e4837018c'::uuid),
      ('e300e7c9-0975-46af-b80c-deedf797dd99'::uuid, '5551a5c2-839b-4df3-a09d-d70a5dc6892e'::uuid),
      ('00ada9cb-4514-47ae-bce9-26c9420de1e7'::uuid, '61634fd5-04cc-4295-a3db-cb4e8b0a6b8e'::uuid),
      ('b49326ef-9697-4f01-9c57-32d63685ba9b'::uuid, '00deb5e0-40fb-4e9b-8cd3-37d3c928de55'::uuid),
      ('5e193148-a046-4ac4-a307-2f369d384e40'::uuid, '7946286b-cad0-466f-a169-00f3530f729b'::uuid)
    ) AS m(canonical_id, duplicate_id)
  LOOP
    UPDATE public.cargo_riscos
       SET risco_id = merges.canonical_id
     WHERE risco_id = merges.duplicate_id
       AND NOT EXISTS (
         SELECT 1 FROM public.cargo_riscos c2
         WHERE c2.role_id = cargo_riscos.role_id
           AND c2.risco_id = merges.canonical_id
       );
    DELETE FROM public.cargo_riscos WHERE risco_id = merges.duplicate_id;

    UPDATE public.risco_exames
       SET risco_id = merges.canonical_id
     WHERE risco_id = merges.duplicate_id
       AND NOT EXISTS (
         SELECT 1 FROM public.risco_exames re2
         WHERE re2.exam_id = risco_exames.exam_id
           AND re2.risco_id = merges.canonical_id
       );
    DELETE FROM public.risco_exames WHERE risco_id = merges.duplicate_id;

    DELETE FROM public.catalogo_riscos WHERE id = merges.duplicate_id;
  END LOOP;
END $$;

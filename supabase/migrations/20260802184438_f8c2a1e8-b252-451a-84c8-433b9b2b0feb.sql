INSERT INTO public.catalogo_riscos (categoria, nome, efeitos_tipicos, medidas_controle_padrao, nrs_aplicaveis, epis_sugeridos, ativo)
SELECT 'PSICOSSOCIAL',
       p.perigo,
       CASE WHEN p.agravo IS NULL OR p.agravo = '' THEN ARRAY[]::text[] ELSE ARRAY[p.agravo] END,
       COALESCE(
         CASE
           WHEN p.controles_sugeridos IS NULL THEN ARRAY[]::text[]
           WHEN pg_typeof(p.controles_sugeridos)::text LIKE '%[]' THEN p.controles_sugeridos::text[]
           ELSE ARRAY[p.controles_sugeridos::text]
         END, ARRAY[]::text[]),
       ARRAY['NR-01'],
       ARRAY[]::text[],
       true
FROM public.catalogo_perigos_psicossociais p
WHERE p.ativo = true
ON CONFLICT (categoria, nome) DO NOTHING;
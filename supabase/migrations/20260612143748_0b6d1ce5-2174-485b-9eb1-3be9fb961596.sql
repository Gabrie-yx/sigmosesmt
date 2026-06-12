
ALTER TABLE public.pgr_inventario_riscos DROP CONSTRAINT IF EXISTS pgr_inventario_riscos_categoria_check;
ALTER TABLE public.pgr_inventario_riscos ADD CONSTRAINT pgr_inventario_riscos_categoria_check
  CHECK (categoria = ANY (ARRAY['FISICO','QUIMICO','BIOLOGICO','ERGONOMICO','ACIDENTE','PSICOSSOCIAL']));

UPDATE public.pgr_inventario_riscos
   SET categoria = 'PSICOSSOCIAL',
       perigo = btrim(regexp_replace(perigo, '^\[Psicossocial\]\s*', ''))
 WHERE perigo LIKE '[Psicossocial]%';

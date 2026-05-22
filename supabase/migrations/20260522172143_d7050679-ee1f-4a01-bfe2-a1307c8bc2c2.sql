CREATE OR REPLACE FUNCTION public.pt_title_case(s text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[];
  out_parts text[] := ARRAY[]::text[];
  w text;
  sub_parts text[];
  sub_out text[];
  sp text;
  i int := 0;
  minusc text[] := ARRAY['de','da','do','das','dos','e','di','du','del','la','le','von','van'];
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  parts := regexp_split_to_array(btrim(lower(s)), '\s+');
  FOREACH w IN ARRAY parts LOOP
    i := i + 1;
    IF i > 1 AND w = ANY(minusc) THEN
      out_parts := out_parts || w;
    ELSE
      sub_parts := string_to_array(w, '-');
      sub_out := ARRAY[]::text[];
      FOREACH sp IN ARRAY sub_parts LOOP
        IF length(sp) = 0 THEN
          sub_out := sub_out || sp;
        ELSE
          sub_out := sub_out || (upper(left(sp,1)) || substr(sp,2));
        END IF;
      END LOOP;
      out_parts := out_parts || array_to_string(sub_out, '-');
    END IF;
  END LOOP;
  RETURN array_to_string(out_parts, ' ');
END;
$$;

UPDATE public.employees
SET nome = public.pt_title_case(nome)
WHERE nome IS NOT NULL
  AND nome <> public.pt_title_case(nome);
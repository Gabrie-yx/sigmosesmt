
CREATE OR REPLACE FUNCTION public.psico_after_insert_resposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.psico_campanhas c
     SET total_respostas = (
           SELECT COUNT(*) FROM public.psico_tokens t
            WHERE t.campanha_id = NEW.campanha_id AND t.usado_em IS NOT NULL
         ),
         updated_at = now()
   WHERE c.id = NEW.campanha_id;
  RETURN NEW;
END;
$$;

-- Backfill dos contadores existentes
UPDATE public.psico_campanhas c
   SET total_respostas = COALESCE((
         SELECT COUNT(*) FROM public.psico_tokens t
          WHERE t.campanha_id = c.id AND t.usado_em IS NOT NULL
       ), 0);

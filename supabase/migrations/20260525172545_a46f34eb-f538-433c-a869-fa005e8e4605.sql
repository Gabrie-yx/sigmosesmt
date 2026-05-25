-- Robustez: ignorar attendees cujo employee_id não existe mais em employees,
-- evitando FK violation em training_matrix_entries ao salvar/editar treinamento.

CREATE OR REPLACE FUNCTION public.sync_attendee_to_matrix()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course uuid;
  v_data date;
  v_titulo text;
BEGIN
  SELECT t.course_id, t.data_realizacao, COALESCE(t.titulo, t.tipo)
    INTO v_course, v_data, v_titulo
  FROM public.trainings t WHERE t.id = NEW.training_id;

  IF v_course IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.situacao,'') NOT IN ('APROVADO','PRESENTE') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = NEW.employee_id) THEN
    RETURN NEW;
  END IF;

  UPDATE public.training_matrix_entries
     SET data_realizacao = v_data,
         observacao = COALESCE(observacao, '') || CASE WHEN observacao IS NULL OR observacao = '' THEN '' ELSE ' | ' END
                      || 'Treinamento: ' || COALESCE(v_titulo,''),
         updated_at = now()
   WHERE employee_id = NEW.employee_id AND course_id = v_course;

  IF NOT FOUND THEN
    INSERT INTO public.training_matrix_entries (employee_id, course_id, data_realizacao, observacao)
    VALUES (NEW.employee_id, v_course, v_data, 'Treinamento: ' || COALESCE(v_titulo,''));
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_training_to_matrix()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_titulo text := COALESCE(NEW.titulo, NEW.tipo);
BEGIN
  IF NEW.course_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.course_id IS NOT DISTINCT FROM NEW.course_id
     AND OLD.data_realizacao = NEW.data_realizacao THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT ta.employee_id
      FROM public.training_attendees ta
      JOIN public.employees e ON e.id = ta.employee_id
     WHERE ta.training_id = NEW.id AND ta.situacao IN ('APROVADO','PRESENTE')
  LOOP
    UPDATE public.training_matrix_entries
       SET data_realizacao = NEW.data_realizacao, updated_at = now()
     WHERE employee_id = r.employee_id AND course_id = NEW.course_id;
    IF NOT FOUND THEN
      INSERT INTO public.training_matrix_entries (employee_id, course_id, data_realizacao, observacao)
      VALUES (r.employee_id, NEW.course_id, NEW.data_realizacao, 'Treinamento: ' || COALESCE(v_titulo,''));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
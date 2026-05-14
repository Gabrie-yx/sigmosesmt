-- Vínculo entre eventos de treinamento e o catálogo da matriz
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.training_matrix_courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trainings_course_id ON public.trainings(course_id);
CREATE INDEX IF NOT EXISTS idx_tme_emp_course ON public.training_matrix_entries(employee_id, course_id);

-- Sincroniza um attendee -> matriz
CREATE OR REPLACE FUNCTION public.sync_attendee_to_matrix()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_attendee_to_matrix ON public.training_attendees;
CREATE TRIGGER trg_attendee_to_matrix
AFTER INSERT OR UPDATE OF situacao, employee_id, training_id ON public.training_attendees
FOR EACH ROW EXECUTE FUNCTION public.sync_attendee_to_matrix();

-- Quando o evento muda data ou course_id, propaga para todos os participantes aprovados/presentes
CREATE OR REPLACE FUNCTION public.sync_training_to_matrix()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT employee_id FROM public.training_attendees
     WHERE training_id = NEW.id AND situacao IN ('APROVADO','PRESENTE')
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
$$;

DROP TRIGGER IF EXISTS trg_training_to_matrix ON public.trainings;
CREATE TRIGGER trg_training_to_matrix
AFTER INSERT OR UPDATE OF data_realizacao, course_id ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.sync_training_to_matrix();
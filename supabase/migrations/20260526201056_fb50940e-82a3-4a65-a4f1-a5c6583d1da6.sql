
-- Clean orphans first so FK creation succeeds
DELETE FROM public.training_attendees
WHERE employee_id IS NULL
   OR training_id IS NULL
   OR employee_id NOT IN (SELECT id FROM public.employees)
   OR training_id NOT IN (SELECT id FROM public.trainings);

ALTER TABLE public.training_attendees
  ADD CONSTRAINT training_attendees_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  ADD CONSTRAINT training_attendees_training_id_fkey
    FOREIGN KEY (training_id) REFERENCES public.trainings(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';

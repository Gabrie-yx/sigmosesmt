
DROP POLICY IF EXISTS employee_docs_select ON public.employee_docs;
CREATE POLICY employee_docs_select ON public.employee_docs FOR SELECT USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS employee_exams_select ON public.employee_exams;
CREATE POLICY employee_exams_select ON public.employee_exams FOR SELECT USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS vaccinations_select ON public.employee_vaccinations;
CREATE POLICY vaccinations_select ON public.employee_vaccinations FOR SELECT USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS training_attendees_select ON public.training_attendees;
CREATE POLICY training_attendees_select ON public.training_attendees FOR SELECT USING (public.is_viewer_or_above(auth.uid()));

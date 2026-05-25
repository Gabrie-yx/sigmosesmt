DELETE FROM public.training_attendees ta
WHERE NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = ta.employee_id);
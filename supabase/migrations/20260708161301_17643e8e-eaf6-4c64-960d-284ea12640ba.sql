DROP INDEX IF EXISTS public.cal_req_norma_idx;
CREATE INDEX cal_req_norma_idx ON public.cal_requisitos ((left(norma, 200)));
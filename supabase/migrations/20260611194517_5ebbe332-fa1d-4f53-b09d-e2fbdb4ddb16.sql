ALTER TABLE public.purchase_requisitions ADD COLUMN titulo TEXT;
COMMENT ON COLUMN public.purchase_requisitions.titulo IS 'Título descritivo ou finalidade da requisição de compra';
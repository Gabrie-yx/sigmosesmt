
CREATE TABLE public.inspecao_nc_nrs_correlatas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.inspecao_ncs(id) ON DELETE CASCADE,
  nr_codigo text NOT NULL,
  nr_item text,
  catalogo_item_id uuid REFERENCES public.catalogo_nrs_itens(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nc_id, nr_codigo, nr_item)
);
CREATE INDEX ix_nc_nrs_correlatas_nc ON public.inspecao_nc_nrs_correlatas(nc_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_nc_nrs_correlatas TO authenticated;
GRANT ALL ON public.inspecao_nc_nrs_correlatas TO service_role;

ALTER TABLE public.inspecao_nc_nrs_correlatas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read nc correlatas" ON public.inspecao_nc_nrs_correlatas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write nc correlatas" ON public.inspecao_nc_nrs_correlatas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update nc correlatas" ON public.inspecao_nc_nrs_correlatas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete nc correlatas" ON public.inspecao_nc_nrs_correlatas
  FOR DELETE TO authenticated USING (true);

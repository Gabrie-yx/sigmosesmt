CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public.cbo_catalogo (
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Ocupação','Sinônimo')),
  codigo_familia TEXT GENERATED ALWAYS AS (substring(codigo from 1 for 4)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo, titulo)
);

GRANT SELECT ON public.cbo_catalogo TO authenticated, anon;
GRANT ALL ON public.cbo_catalogo TO service_role;

ALTER TABLE public.cbo_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cbo_catalogo_read_all" ON public.cbo_catalogo
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS cbo_catalogo_titulo_trgm
  ON public.cbo_catalogo USING gin (lower(titulo) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS cbo_catalogo_codigo_idx
  ON public.cbo_catalogo (codigo);

ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS cbo_titulo TEXT;
CREATE TABLE IF NOT EXISTS public.unidade_campos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  aba text NOT NULL DEFAULT 'Dados',
  aba_ordem integer NOT NULL DEFAULT 0,
  chave text NOT NULL,
  label text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  obrigatorio boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ajuda text NULL,
  mostrar_lista boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_unidade_campos_chave_global
  ON public.unidade_campos (chave) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_unidade_campos_chave_empresa
  ON public.unidade_campos (company_id, chave) WHERE company_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidade_campos TO authenticated;
GRANT ALL ON public.unidade_campos TO service_role;

ALTER TABLE public.unidade_campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidade_campos_select" ON public.unidade_campos;
CREATE POLICY "unidade_campos_select" ON public.unidade_campos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "unidade_campos_insert" ON public.unidade_campos;
CREATE POLICY "unidade_campos_insert" ON public.unidade_campos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "unidade_campos_update" ON public.unidade_campos;
CREATE POLICY "unidade_campos_update" ON public.unidade_campos
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "unidade_campos_delete" ON public.unidade_campos;
CREATE POLICY "unidade_campos_delete" ON public.unidade_campos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_unidade_campos_updated_at ON public.unidade_campos;
CREATE TRIGGER trg_unidade_campos_updated_at
  BEFORE UPDATE ON public.unidade_campos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cascos
  ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
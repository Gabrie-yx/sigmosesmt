CREATE TABLE IF NOT EXISTS public.documentos_assinados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  modulo text NOT NULL DEFAULT 'avulso',
  referencia_id text NULL,
  pdf_assinado_path text NOT NULL,
  assinaturas jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_assinaturas integer NOT NULL DEFAULT 0,
  assinado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  assinado_por_email text NULL,
  assinado_por_nome text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_assinados TO authenticated;
GRANT ALL ON public.documentos_assinados TO service_role;

ALTER TABLE public.documentos_assinados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Logados veem documentos assinados" ON public.documentos_assinados;
CREATE POLICY "Logados veem documentos assinados"
ON public.documentos_assinados
FOR SELECT
TO authenticated
USING (public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "Editores cadastram documentos assinados" ON public.documentos_assinados;
CREATE POLICY "Editores cadastram documentos assinados"
ON public.documentos_assinados
FOR INSERT
TO authenticated
WITH CHECK (public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "Editores atualizam documentos assinados" ON public.documentos_assinados;
CREATE POLICY "Editores atualizam documentos assinados"
ON public.documentos_assinados
FOR UPDATE
TO authenticated
USING (public.is_editor(auth.uid()))
WITH CHECK (public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "Admins removem documentos assinados" ON public.documentos_assinados;
CREATE POLICY "Admins removem documentos assinados"
ON public.documentos_assinados
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_documentos_assinados_updated_at ON public.documentos_assinados;
CREATE TRIGGER update_documentos_assinados_updated_at
BEFORE UPDATE ON public.documentos_assinados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
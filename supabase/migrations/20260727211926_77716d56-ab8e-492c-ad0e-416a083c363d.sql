CREATE TABLE public.pgr_acoes_biblioteca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  perigo_padrao text NOT NULL,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  niveis text[] NOT NULL DEFAULT '{BAIXO,MODERADO,ALTO,MUITO_ALTO}',
  acao text NOT NULL,
  como text,
  hierarquia text NOT NULL DEFAULT 'ADMINISTRATIVA',
  prioridade text NOT NULL DEFAULT 'MEDIA',
  prazo_dias integer NOT NULL DEFAULT 30,
  norma_ref text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pgr_acoes_bib_cat ON public.pgr_acoes_biblioteca (categoria) WHERE ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_acoes_biblioteca TO authenticated;
GRANT ALL ON public.pgr_acoes_biblioteca TO service_role;

ALTER TABLE public.pgr_acoes_biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Biblioteca: leitura autenticada" ON public.pgr_acoes_biblioteca
  FOR SELECT TO authenticated USING (is_viewer_or_above(auth.uid()));
CREATE POLICY "Biblioteca: editores podem inserir" ON public.pgr_acoes_biblioteca
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY "Biblioteca: editores podem atualizar" ON public.pgr_acoes_biblioteca
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY "Biblioteca: admin pode excluir" ON public.pgr_acoes_biblioteca
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pgr_acoes_bib_updated
  BEFORE UPDATE ON public.pgr_acoes_biblioteca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pgr_plano_acao
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN IF NOT EXISTS hierarquia text,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS biblioteca_id uuid REFERENCES public.pgr_acoes_biblioteca(id) ON DELETE SET NULL;

CREATE TABLE public.prestadores_saude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text UNIQUE,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  telefone text,
  email text,
  contato_responsavel text,
  especialidades text[] NOT NULL DEFAULT '{}'::text[],
  tipos_guia_esocial text[] NOT NULL DEFAULT '{}'::text[],
  horario_atendimento text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestadores_saude TO authenticated;
GRANT ALL ON public.prestadores_saude TO service_role;

ALTER TABLE public.prestadores_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers podem ler prestadores"
  ON public.prestadores_saude FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editors podem inserir prestadores"
  ON public.prestadores_saude FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Editors podem atualizar prestadores"
  ON public.prestadores_saude FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()));

CREATE POLICY "Moderators podem excluir prestadores"
  ON public.prestadores_saude FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_prestadores_saude_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_prestadores_saude_updated_at
  BEFORE UPDATE ON public.prestadores_saude
  FOR EACH ROW EXECUTE FUNCTION public.update_prestadores_saude_updated_at();

CREATE INDEX idx_prestadores_saude_ativo ON public.prestadores_saude(ativo) WHERE ativo = true;
CREATE INDEX idx_prestadores_saude_cidade ON public.prestadores_saude(cidade);

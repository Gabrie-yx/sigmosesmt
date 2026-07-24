-- Coordenador PCMSO (NR-07 7.3.2) — um médico responsável por empresa
CREATE TABLE public.pcmso_coordenadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  crm TEXT NOT NULL,
  crm_uf TEXT NOT NULL,
  especialidade TEXT,
  email TEXT,
  telefone TEXT,
  contrato_inicio DATE,
  contrato_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  assinatura_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX pcmso_coordenadores_company_idx ON public.pcmso_coordenadores(company_id) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcmso_coordenadores TO authenticated;
GRANT ALL ON public.pcmso_coordenadores TO service_role;

ALTER TABLE public.pcmso_coordenadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcmso_coord_select_auth"
  ON public.pcmso_coordenadores FOR SELECT TO authenticated USING (true);

CREATE POLICY "pcmso_coord_manage_sesmt"
  ON public.pcmso_coordenadores FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tst')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tst')
  );

CREATE TRIGGER pcmso_coordenadores_updated_at
  BEFORE UPDATE ON public.pcmso_coordenadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Clínicas Ocupacionais credenciadas
CREATE TABLE public.clinicas_ocupacionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  telefone TEXT,
  email TEXT,
  contato_responsavel TEXT,
  especialidades TEXT[] NOT NULL DEFAULT '{}',
  tipos_exame TEXT[] NOT NULL DEFAULT '{}',
  ativa BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX clinicas_ocupacionais_ativa_idx ON public.clinicas_ocupacionais(ativa);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinicas_ocupacionais TO authenticated;
GRANT ALL ON public.clinicas_ocupacionais TO service_role;

ALTER TABLE public.clinicas_ocupacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinicas_select_auth"
  ON public.clinicas_ocupacionais FOR SELECT TO authenticated USING (true);

CREATE POLICY "clinicas_manage_sesmt"
  ON public.clinicas_ocupacionais FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tst')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tst')
  );

CREATE TRIGGER clinicas_ocupacionais_updated_at
  BEFORE UPDATE ON public.clinicas_ocupacionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
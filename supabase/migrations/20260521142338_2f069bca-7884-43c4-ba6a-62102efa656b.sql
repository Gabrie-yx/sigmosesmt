-- Enums
CREATE TYPE public.extintor_tipo_agente AS ENUM ('ABC','BC','A','AP','CO2','PQS','PQS_K','OUTRO');
CREATE TYPE public.extintor_status AS ENUM ('ATIVO','EM_MANUTENCAO','BAIXADO','VENCIDO');

-- Tabela extintores
CREATE TABLE public.extintores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL,
  localizacao TEXT NOT NULL,
  tipo_agente public.extintor_tipo_agente NOT NULL,
  carga_nominal NUMERIC(8,2),
  carga_unidade TEXT DEFAULT 'kg',
  capacidade_extintora TEXT,
  numero_selo_inmetro TEXT,
  data_fabricacao DATE,
  data_ultima_recarga DATE,
  proxima_recarga DATE,
  ano_teste_hidrostatico INT,
  proximo_teste_hidrostatico INT,
  fabricante TEXT,
  empresa_responsavel TEXT,
  foto_path TEXT,
  status public.extintor_status NOT NULL DEFAULT 'ATIVO',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_extintores_area ON public.extintores(area);
CREATE INDEX idx_extintores_status ON public.extintores(status);
CREATE INDEX idx_extintores_proxima_recarga ON public.extintores(proxima_recarga);

-- Tabela inspeções
CREATE TABLE public.extintor_inspecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extintor_id UUID NOT NULL REFERENCES public.extintores(id) ON DELETE CASCADE,
  data_inspecao DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel_nome TEXT NOT NULL,
  responsavel_registro TEXT,
  -- Checklist 12 itens (legenda do FOR-SFG 08)
  -- 1.Pintura 2.Gatilho 3.Trava de segurança 4.Lacre Quebrado 5.Bico Quebrado/Entupido
  -- 6.Mangote 7.Difusor (CO2) 8.Obstruído por objetos 9.Sinalização horizontal (piso)
  -- 10.Sinalização vertical (parede) 11.Carga Vencida 12.Teste Hidrostático Vencido
  nc_codigos INT[] NOT NULL DEFAULT '{}',
  nao_conformidade TEXT,
  observacoes TEXT,
  conforme BOOLEAN NOT NULL DEFAULT true,
  foto_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_extintor_inspecoes_extintor ON public.extintor_inspecoes(extintor_id);
CREATE INDEX idx_extintor_inspecoes_data ON public.extintor_inspecoes(data_inspecao);

-- Trigger updated_at
CREATE TRIGGER trg_extintores_updated_at
  BEFORE UPDATE ON public.extintores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: próximo número de extintor (sequencial simples se não informado)
CREATE OR REPLACE FUNCTION public.gerar_numero_extintor()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::INT), 0) + 1
    INTO v_seq
    FROM public.extintores
   WHERE numero ~ '^\d+$';
  RETURN lpad(v_seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.extintor_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_extintor();
  END IF;
  -- Auto-calcula próxima recarga (12 meses) se não informada
  IF NEW.proxima_recarga IS NULL AND NEW.data_ultima_recarga IS NOT NULL THEN
    NEW.proxima_recarga := NEW.data_ultima_recarga + INTERVAL '12 months';
  END IF;
  -- Auto-calcula próximo hidrostático (5 anos) se não informado
  IF NEW.proximo_teste_hidrostatico IS NULL AND NEW.ano_teste_hidrostatico IS NOT NULL THEN
    NEW.proximo_teste_hidrostatico := NEW.ano_teste_hidrostatico + 5;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_extintor_before_insert
  BEFORE INSERT ON public.extintores
  FOR EACH ROW EXECUTE FUNCTION public.extintor_before_insert();

-- Trigger para recalcular próxima recarga em UPDATE
CREATE OR REPLACE FUNCTION public.extintor_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_ultima_recarga IS DISTINCT FROM OLD.data_ultima_recarga AND NEW.data_ultima_recarga IS NOT NULL THEN
    NEW.proxima_recarga := NEW.data_ultima_recarga + INTERVAL '12 months';
  END IF;
  IF NEW.ano_teste_hidrostatico IS DISTINCT FROM OLD.ano_teste_hidrostatico AND NEW.ano_teste_hidrostatico IS NOT NULL THEN
    NEW.proximo_teste_hidrostatico := NEW.ano_teste_hidrostatico + 5;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_extintor_before_update
  BEFORE UPDATE ON public.extintores
  FOR EACH ROW EXECUTE FUNCTION public.extintor_before_update();

-- RLS
ALTER TABLE public.extintores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extintor_inspecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver extintores"
  ON public.extintores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editores podem inserir extintores"
  ON public.extintores FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editores podem atualizar extintores"
  ON public.extintores FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "Admins podem excluir extintores"
  ON public.extintores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Autenticados podem ver inspeções"
  ON public.extintor_inspecoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editores podem inserir inspeções"
  ON public.extintor_inspecoes FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editores podem atualizar inspeções"
  ON public.extintor_inspecoes FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "Admins podem excluir inspeções"
  ON public.extintor_inspecoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Bucket storage
INSERT INTO storage.buckets (id, name, public) VALUES ('extintores-fotos', 'extintores-fotos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticados podem ver fotos extintores"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'extintores-fotos');
CREATE POLICY "Editores podem subir fotos extintores"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'extintores-fotos' AND public.is_editor(auth.uid()));
CREATE POLICY "Editores podem atualizar fotos extintores"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'extintores-fotos' AND public.is_editor(auth.uid()));
CREATE POLICY "Admins podem excluir fotos extintores"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'extintores-fotos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
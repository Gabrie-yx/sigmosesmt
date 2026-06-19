
CREATE TABLE public.extintor_inspecoes_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extintor_id UUID REFERENCES public.extintores(id) ON DELETE SET NULL,
  inspecionado_por UUID NOT NULL,
  inspecionado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  foto_etiqueta_path TEXT,
  foto_manometro_path TEXT,
  foto_lacre_path TEXT,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  gps_accuracy NUMERIC,
  localizacao_descritiva TEXT,
  laudo_ia JSONB,
  laudo_revisado JSONB,
  confianca_ia NUMERIC,
  status_geral TEXT NOT NULL DEFAULT 'pendente_revisao',
  nao_conformidades TEXT[] DEFAULT '{}',
  assinatura_path TEXT,
  assinado_por_nome TEXT,
  assinado_por_cargo TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extintor_inspecoes_fotos TO authenticated;
GRANT ALL ON public.extintor_inspecoes_fotos TO service_role;

ALTER TABLE public.extintor_inspecoes_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth pode ver inspecoes foto"
  ON public.extintor_inspecoes_fotos FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth pode criar inspecoes foto"
  ON public.extintor_inspecoes_fotos FOR INSERT TO authenticated
  WITH CHECK (inspecionado_por = auth.uid());

CREATE POLICY "admin/tst/autor editam inspecoes foto"
  ON public.extintor_inspecoes_fotos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst') OR inspecionado_por = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst') OR inspecionado_por = auth.uid());

CREATE POLICY "admin/tst apagam inspecoes foto"
  ON public.extintor_inspecoes_fotos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));

CREATE INDEX idx_extintor_inspecoes_fotos_extintor ON public.extintor_inspecoes_fotos(extintor_id);
CREATE INDEX idx_extintor_inspecoes_fotos_data ON public.extintor_inspecoes_fotos(inspecionado_em DESC);

CREATE TRIGGER update_extintor_inspecoes_fotos_updated_at
  BEFORE UPDATE ON public.extintor_inspecoes_fotos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies do bucket 'extintores-inspecoes' (crie o bucket pelo dashboard como privado)
CREATE POLICY "auth ve fotos extintores-inspecoes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'extintores-inspecoes');

CREATE POLICY "auth envia fotos extintores-inspecoes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'extintores-inspecoes');

CREATE POLICY "autor atualiza fotos extintores-inspecoes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'extintores-inspecoes' AND owner = auth.uid());

CREATE POLICY "admin/tst/autor apagam fotos extintores-inspecoes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'extintores-inspecoes' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst') OR owner = auth.uid()));

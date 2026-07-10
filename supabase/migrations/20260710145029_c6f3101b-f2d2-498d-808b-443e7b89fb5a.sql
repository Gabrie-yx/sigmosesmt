
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  modulo_alvo text,
  motor_render_id text,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read templates" ON public.document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write templates" ON public.document_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  revisao int NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_hash text,
  tamanho_bytes bigint,
  motivo_alteracao text NOT NULL,
  status text NOT NULL DEFAULT 'EM_HOMOLOGACAO'
    CHECK (status IN ('EM_HOMOLOGACAO','HOMOLOGADA','SUPERSEDIDA')),
  homologada_em timestamptz,
  homologada_por uuid REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, revisao)
);
CREATE INDEX idx_dtv_template ON public.document_template_versions(template_id, revisao DESC);
GRANT SELECT ON public.document_template_versions TO authenticated;
GRANT ALL ON public.document_template_versions TO service_role;
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read versions" ON public.document_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write versions" ON public.document_template_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.document_template_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.document_template_versions(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  prazo_sugerido date,
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES auth.users(id),
  nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dtp_pendentes ON public.document_template_pendencias(template_id) WHERE resolvido_em IS NULL;
GRANT SELECT ON public.document_template_pendencias TO authenticated;
GRANT ALL ON public.document_template_pendencias TO service_role;
ALTER TABLE public.document_template_pendencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pendencias" ON public.document_template_pendencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pendencias" ON public.document_template_pendencias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_dt_updated BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dtv_updated BEFORE UPDATE ON public.document_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dtp_updated BEFORE UPDATE ON public.document_template_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.document_templates (codigo, nome, modulo_alvo, motor_render_id, descricao, ordem) VALUES
  ('FOR-SEG-01','Ordem de Serviço (NR-01)','oss','oss-pdf','Ordem de Serviço emitida por cargo/função.',1),
  ('FOR-SEG-02','Ficha de Registro Individual de Treinamento','trainings','lista-presenca-pdf','Ficha de treinamento por colaborador.',2),
  ('FOR-SEG-03','Requisição de Compra SESMT','sesmt-requisicoes','requisicao-compra-pdf','Requisição de compra do SESMT.',3),
  ('FOR-SEG-04','Ficha de Entrega de EPI','estoque','epi-ficha-pdf','Ficha nominal de entrega de EPI.',4),
  ('FOR-SEG-05','Permissão de Trabalho / PTE','ptes','pte-pdf','Permissão de Trabalho Especial.',5),
  ('FOR-SEG-06','Análise Preliminar de Risco (APR)','aprs','apr-pdf','APR emitida por atividade.',6),
  ('FOR-SEG-07','Diálogo Diário de Segurança (DDS)','dds','dds-formulario-semanal-pdf','Registro de DDS.',7),
  ('FOR-SEG-08','Ficha de Inspeção de Extintores','extintores','extintores-pdf','Inspeção mensal de extintores.',8),
  ('FOR-SEG-09','Quadro Estatístico de Acidentes','acidentes','pdf-acidentes','Estatísticas mensais de acidentes de trabalho.',9),
  ('FOR-SEG-10','Registro de Dias sem Acidentes','indicadores',NULL,'Painel/registro de dias sem acidentes.',10),
  ('FOR-SEG-11','Calendário de Reuniões da CIPA','cipa',NULL,'Calendário anual da CIPA.',11),
  ('FOR-SEG-12','Cronograma de Simulados de Emergência','emergencia',NULL,'Cronograma anual de simulados.',12),
  ('FOR-SEG-13','Matriz de Treinamentos','matriz-treinamento','matriz-treinamento','Matriz consolidada de treinamentos.',13),
  ('FOR-SEG-14','Relatório de Investigação de Acidente','incidentes','for-seg-14-pdf','Relatório final de investigação (RIA).',14),
  ('FOR-SEG-15','Relatório de Simulado de Emergência','emergencia',NULL,'Relatório pós-simulado de emergência.',15);

CREATE POLICY "admin read templates bucket" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'templates-homologados' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write templates bucket" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'templates-homologados' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update templates bucket" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'templates-homologados' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete templates bucket" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'templates-homologados' AND public.has_role(auth.uid(), 'admin'));

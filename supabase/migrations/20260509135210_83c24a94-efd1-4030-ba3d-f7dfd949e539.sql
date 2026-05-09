
-- Tabela de treinamentos (o evento)
CREATE TABLE public.trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT,
  instrutor TEXT,
  instituicao TEXT,
  data_realizacao DATE NOT NULL,
  carga_horaria_h NUMERIC(6,2) NOT NULL DEFAULT 0,
  validade_meses INTEGER NOT NULL DEFAULT 12,
  anexo_path TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainings_tipo ON public.trainings(tipo);
CREATE INDEX idx_trainings_data ON public.trainings(data_realizacao DESC);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainings_select" ON public.trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainings_insert" ON public.trainings FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "trainings_update" ON public.trainings FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "trainings_delete" ON public.trainings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trainings_updated_at
  BEFORE UPDATE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lista de presença (N colaboradores por treinamento)
CREATE TABLE public.training_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'APROVADO' CHECK (situacao IN ('APROVADO','REPROVADO','PRESENTE','AUSENTE')),
  nota NUMERIC(5,2),
  data_vencimento DATE,
  certificado_path TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_id, employee_id)
);

CREATE INDEX idx_training_attendees_training ON public.training_attendees(training_id);
CREATE INDEX idx_training_attendees_employee ON public.training_attendees(employee_id);
CREATE INDEX idx_training_attendees_vencimento ON public.training_attendees(data_vencimento);

ALTER TABLE public.training_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_attendees_select" ON public.training_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_attendees_insert" ON public.training_attendees FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "training_attendees_update" ON public.training_attendees FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "training_attendees_delete" ON public.training_attendees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auditoria automática
CREATE TRIGGER audit_trainings
  AFTER INSERT OR UPDATE OR DELETE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_training_attendees
  AFTER INSERT OR UPDATE OR DELETE ON public.training_attendees
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Storage: bucket privado para certificados e listas
INSERT INTO storage.buckets (id, name, public) VALUES ('training-docs', 'training-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "training_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-docs');

CREATE POLICY "training_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-docs' AND public.is_editor(auth.uid()));

CREATE POLICY "training_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'training-docs' AND public.is_editor(auth.uid()));

CREATE POLICY "training_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'training-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

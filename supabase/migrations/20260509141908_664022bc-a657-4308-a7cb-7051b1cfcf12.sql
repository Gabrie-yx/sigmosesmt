-- Tabela de controle de imunização
CREATE TABLE public.employee_vaccinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  tipo_vacina TEXT NOT NULL,
  dose TEXT,
  data_aplicacao DATE NOT NULL,
  data_proxima_dose DATE,
  lote TEXT,
  fabricante TEXT,
  anexo_path TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_vacc_employee ON public.employee_vaccinations(employee_id);

ALTER TABLE public.employee_vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaccinations_select" ON public.employee_vaccinations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vaccinations_insert" ON public.employee_vaccinations
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY "vaccinations_update" ON public.employee_vaccinations
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY "vaccinations_delete" ON public.employee_vaccinations
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Vacinas obrigatórias e flag biológica nos cargos
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS req_vacinas TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS risco_biologico BOOLEAN NOT NULL DEFAULT false;

-- Bucket privado para a carteira de vacinação
INSERT INTO storage.buckets (id, name, public)
VALUES ('vaccination-cards', 'vaccination-cards', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vacc_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vaccination-cards');
CREATE POLICY "vacc_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vaccination-cards' AND is_editor(auth.uid()));
CREATE POLICY "vacc_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vaccination-cards' AND is_editor(auth.uid()));
CREATE POLICY "vacc_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vaccination-cards' AND has_role(auth.uid(), 'admin'::app_role));
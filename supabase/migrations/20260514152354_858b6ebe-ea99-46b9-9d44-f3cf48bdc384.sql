-- 1. setor em employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS setor TEXT;

-- 2. catálogo de cursos
CREATE TABLE IF NOT EXISTS public.training_matrix_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  periodicidade TEXT NOT NULL DEFAULT 'ANUAL', -- ADMISSAO | ANUAL | BIENAL | NA
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_matrix_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tmc_select ON public.training_matrix_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY tmc_insert ON public.training_matrix_courses FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY tmc_update ON public.training_matrix_courses FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY tmc_delete ON public.training_matrix_courses FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER tmc_updated BEFORE UPDATE ON public.training_matrix_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. mapeamento setor -> curso
CREATE TABLE IF NOT EXISTS public.training_matrix_sector_courses (
  setor TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES public.training_matrix_courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (setor, course_id)
);
ALTER TABLE public.training_matrix_sector_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tmsc_select ON public.training_matrix_sector_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY tmsc_insert ON public.training_matrix_sector_courses FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY tmsc_update ON public.training_matrix_sector_courses FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY tmsc_delete ON public.training_matrix_sector_courses FOR DELETE TO authenticated USING (is_editor(auth.uid()));

-- 4. lançamentos por colaborador x curso
CREATE TABLE IF NOT EXISTS public.training_matrix_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.training_matrix_courses(id) ON DELETE CASCADE,
  data_realizacao DATE,
  status_override TEXT, -- REALIZADO | PENDENTE | NAO_SE_APLICA | EM_ANDAMENTO
  observacao TEXT,
  anexo_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, course_id)
);
CREATE INDEX IF NOT EXISTS tme_emp_idx ON public.training_matrix_entries(employee_id);
CREATE INDEX IF NOT EXISTS tme_course_idx ON public.training_matrix_entries(course_id);
ALTER TABLE public.training_matrix_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tme_select ON public.training_matrix_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY tme_insert ON public.training_matrix_entries FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY tme_update ON public.training_matrix_entries FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY tme_delete ON public.training_matrix_entries FOR DELETE TO authenticated USING (is_editor(auth.uid()));
CREATE TRIGGER tme_updated BEFORE UPDATE ON public.training_matrix_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed dos 15 cursos (matriz Atem 2026)
INSERT INTO public.training_matrix_courses (codigo, nome, periodicidade, ordem) VALUES
  ('INTEGRACAO',  'Integração',                'ADMISSAO', 10),
  ('NR-05',       'CIPA - NR-05',              'ANUAL',    20),
  ('NR-20',       'NR-20 (Inflamáveis)',       'BIENAL',   30),
  ('NR-07',       'NR-07 (PCMSO)',             'ANUAL',    40),
  ('NR-06',       'NR-06 (EPI)',               'ANUAL',    50),
  ('NR-17',       'NR-17 (Ergonomia)',         'ANUAL',    60),
  ('NR-10',       'NR-10 (Elétrica)',          'BIENAL',   70),
  ('NR-10-SEP',   'NR-10 SEP',                 'BIENAL',   80),
  ('NR-23',       'NR-23 (Combate a Incêndio)','ANUAL',    90),
  ('NR-33',       'NR-33 (Confinado)',         'ANUAL',   100),
  ('NR-34',       'NR-34 (Construção Naval)',  'ANUAL',   110),
  ('NR-35',       'NR-35 (Altura)',            'BIENAL',  120),
  ('NR-11',       'NR-11 (Cargas)',            'BIENAL',  130),
  ('NR-12',       'NR-12 (Máquinas)',          'ANUAL',   140),
  ('OP-GUINDASTE','Operador de Guindaste',     'ANUAL',   150)
ON CONFLICT (codigo) DO NOTHING;

-- 6. Mapeamento setor -> cursos
INSERT INTO public.training_matrix_sector_courses (setor, course_id)
SELECT 'PRODUCAO', id FROM public.training_matrix_courses
ON CONFLICT DO NOTHING;

INSERT INTO public.training_matrix_sector_courses (setor, course_id)
SELECT 'ALMOXARIFADO', id FROM public.training_matrix_courses
WHERE codigo <> 'OP-GUINDASTE'
ON CONFLICT DO NOTHING;

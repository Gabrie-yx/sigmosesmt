
ALTER TABLE public.training_matrix_courses
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'NR',
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS carga_horaria_h numeric;

CREATE TABLE IF NOT EXISTS public.training_matrix_role_courses (
  role_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.training_matrix_courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, course_id)
);

ALTER TABLE public.training_matrix_role_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tmrc_select ON public.training_matrix_role_courses;
DROP POLICY IF EXISTS tmrc_insert ON public.training_matrix_role_courses;
DROP POLICY IF EXISTS tmrc_delete ON public.training_matrix_role_courses;
DROP POLICY IF EXISTS tmrc_update ON public.training_matrix_role_courses;

CREATE POLICY tmrc_select ON public.training_matrix_role_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY tmrc_insert ON public.training_matrix_role_courses FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY tmrc_delete ON public.training_matrix_role_courses FOR DELETE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY tmrc_update ON public.training_matrix_role_courses FOR UPDATE TO authenticated USING (is_editor(auth.uid()));

-- Seed NRs faltantes
INSERT INTO public.training_matrix_courses (codigo, nome, periodicidade, ordem, ativo, categoria)
SELECT v.codigo, v.nome, 'NA', 1000 + v.n, true, 'NR'
FROM (VALUES
  (1,'NR-01','NR-01 — Disposições Gerais e GRO'),
  (2,'NR-04','NR-04 — SESMT'),
  (3,'NR-05','NR-05 — CIPA'),
  (4,'NR-06','NR-06 — EPI'),
  (5,'NR-07','NR-07 — PCMSO'),
  (6,'NR-08','NR-08 — Edificações'),
  (7,'NR-09','NR-09 — PPRA / Agentes Ambientais'),
  (8,'NR-10','NR-10 — Segurança em Eletricidade'),
  (9,'NR-11','NR-11 — Transporte e Movimentação de Materiais'),
  (10,'NR-12','NR-12 — Máquinas e Equipamentos'),
  (11,'NR-13','NR-13 — Caldeiras e Vasos de Pressão'),
  (12,'NR-14','NR-14 — Fornos'),
  (13,'NR-15','NR-15 — Atividades Insalubres'),
  (14,'NR-16','NR-16 — Atividades Periculosas'),
  (15,'NR-17','NR-17 — Ergonomia'),
  (16,'NR-18','NR-18 — Construção'),
  (17,'NR-19','NR-19 — Explosivos'),
  (18,'NR-20','NR-20 — Inflamáveis e Combustíveis'),
  (19,'NR-21','NR-21 — Trabalho a Céu Aberto'),
  (20,'NR-22','NR-22 — Mineração'),
  (21,'NR-23','NR-23 — Proteção Contra Incêndio'),
  (22,'NR-24','NR-24 — Condições Sanitárias'),
  (23,'NR-25','NR-25 — Resíduos Industriais'),
  (24,'NR-26','NR-26 — Sinalização de Segurança'),
  (25,'NR-28','NR-28 — Fiscalização e Penalidades'),
  (26,'NR-29','NR-29 — Trabalho Portuário'),
  (27,'NR-30','NR-30 — Trabalho Aquaviário'),
  (28,'NR-31','NR-31 — Rural'),
  (29,'NR-32','NR-32 — Saúde — Serviços de Saúde'),
  (30,'NR-33','NR-33 — Espaço Confinado'),
  (31,'NR-34','NR-34 — Naval / Construção e Reparação'),
  (32,'NR-35','NR-35 — Trabalho em Altura'),
  (33,'NR-36','NR-36 — Frigoríficos'),
  (34,'NR-37','NR-37 — Plataformas de Petróleo'),
  (35,'NR-38','NR-38 — Limpeza Urbana')
) AS v(n, codigo, nome)
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_matrix_courses c WHERE c.codigo = v.codigo
);

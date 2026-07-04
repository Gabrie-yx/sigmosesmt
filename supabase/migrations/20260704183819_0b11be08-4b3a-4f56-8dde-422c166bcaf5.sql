
-- =========================================================
-- 1. LÍDERES
-- =========================================================
CREATE TABLE public.hora_extra_lideres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hora_extra_lideres TO authenticated;
GRANT ALL ON public.hora_extra_lideres TO service_role;
ALTER TABLE public.hora_extra_lideres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura autenticada lideres" ON public.hora_extra_lideres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia lideres ins" ON public.hora_extra_lideres
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin gerencia lideres upd" ON public.hora_extra_lideres
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin gerencia lideres del" ON public.hora_extra_lideres
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_hora_extra_lideres_updated_at
  BEFORE UPDATE ON public.hora_extra_lideres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. ESCOPO DE CADA LÍDER
-- Tipos:
--   EMPRESA           -> ids: [company_id]  (usa companies.id de UMA empresa)
--   EMPRESA_LISTA     -> ids: [company_id, company_id, ...]  (várias empresas, ex: terceirizadas+MEI)
--   SETOR_EMPRESA     -> company_id + setores: ['PRODUCAO', ...]
--   FUNCIONARIO_ESPECIFICO -> employee_ids: [uuid, uuid, ...]
-- =========================================================
CREATE TABLE public.hora_extra_lider_escopo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lider_id uuid NOT NULL REFERENCES public.hora_extra_lideres(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('EMPRESA','EMPRESA_LISTA','SETOR_EMPRESA','FUNCIONARIO_ESPECIFICO')),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  company_ids uuid[],
  setores text[],
  employee_ids uuid[],
  rotulo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hora_extra_lider_escopo TO authenticated;
GRANT ALL ON public.hora_extra_lider_escopo TO service_role;
ALTER TABLE public.hora_extra_lider_escopo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura escopo autenticada" ON public.hora_extra_lider_escopo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin escopo ins" ON public.hora_extra_lider_escopo
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin escopo upd" ON public.hora_extra_lider_escopo
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin escopo del" ON public.hora_extra_lider_escopo
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_escopo_lider ON public.hora_extra_lider_escopo(lider_id);

-- =========================================================
-- 3. CAMPOS NOVOS EM hora_extra_sabado
-- =========================================================
ALTER TABLE public.hora_extra_sabado
  ADD COLUMN IF NOT EXISTS lider_id uuid REFERENCES public.hora_extra_lideres(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_convocacao text NOT NULL DEFAULT 'SABADO'
    CHECK (tipo_convocacao IN ('SABADO','DIAS_UTEIS')),
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','APROVADA','INDEFERIDA')),
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_decisao_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_indeferimento text;

CREATE INDEX IF NOT EXISTS idx_hora_extra_sabado_status ON public.hora_extra_sabado(status);
CREATE INDEX IF NOT EXISTS idx_hora_extra_sabado_lider ON public.hora_extra_sabado(lider_id);

-- =========================================================
-- 4. HELPER: is_lider_extra(user_id)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_lider_extra(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hora_extra_lideres
    WHERE user_id = _user_id AND ativo = true
  )
$$;

-- =========================================================
-- 5. SEED — 4 líderes + escopos
-- =========================================================
-- Paulo Sérgio (já tem user_id)
INSERT INTO public.hora_extra_lideres (employee_id, user_id, observacao)
VALUES ('166db4c6-02ca-4792-ac59-67c89821b775','c5bd8316-c958-4b69-982c-41dd692a15b6','Líder de Produção DMN')
ON CONFLICT (employee_id) DO NOTHING;

-- Manoel (sem user_id ainda)
INSERT INTO public.hora_extra_lideres (employee_id, observacao)
VALUES ('ce29ee56-c726-4e53-b0ce-7eb9bfd92c9b','Encarregado de Produção — terceirizadas+MEI')
ON CONFLICT (employee_id) DO NOTHING;

-- Natanael (sem user_id)
INSERT INTO public.hora_extra_lideres (employee_id, observacao)
VALUES ('69f97747-394a-4147-8837-10ec54f855d1','Líder Manutenção Elétrica DMN')
ON CONFLICT (employee_id) DO NOTHING;

-- Renato (sem user_id)
INSERT INTO public.hora_extra_lideres (employee_id, observacao)
VALUES ('1cdf304d-c746-41af-8f48-3bbdd9dfde3b','Encarregado LF Serviços (Legado)')
ON CONFLICT (employee_id) DO NOTHING;

-- Escopo Paulo → DMN, Produção
INSERT INTO public.hora_extra_lider_escopo (lider_id, tipo, company_id, setores, rotulo)
SELECT l.id, 'SETOR_EMPRESA', c.id, ARRAY['PRODUCAO'], 'DMN — Produção'
FROM public.hora_extra_lideres l
JOIN public.employees e ON e.id = l.employee_id
JOIN public.companies c ON upper(c.name) LIKE 'DMN%'
WHERE l.employee_id = '166db4c6-02ca-4792-ac59-67c89821b775'
LIMIT 1;

-- Escopo Manoel → todas as terceirizadas + MEI (lista de company_ids exceto DMN e Portaria/Legado)
INSERT INTO public.hora_extra_lider_escopo (lider_id, tipo, company_ids, rotulo)
SELECT l.id, 'EMPRESA_LISTA',
  (SELECT array_agg(c.id) FROM public.companies c
   WHERE upper(c.name) NOT LIKE 'DMN%'
     AND upper(c.name) NOT LIKE '%LF%'
     AND upper(c.name) NOT LIKE '%LEGADO%'
     AND upper(c.name) NOT LIKE '%PORTARIA%'),
  'Terceirizadas + MEI'
FROM public.hora_extra_lideres l
WHERE l.employee_id = 'ce29ee56-c726-4e53-b0ce-7eb9bfd92c9b';

-- Escopo Natanael → só Leonardo DMN (precisa encontrar o Leonardo)
INSERT INTO public.hora_extra_lider_escopo (lider_id, tipo, employee_ids, rotulo)
SELECT l.id, 'FUNCIONARIO_ESPECIFICO',
  (SELECT array_agg(e.id) FROM public.employees e
    WHERE e.status='ATIVO' AND e.nome ILIKE 'leonardo%'
      AND e.tipo_vinculo='PROPRIO'),
  'Leonardo (DMN CLT)'
FROM public.hora_extra_lideres l
WHERE l.employee_id = '69f97747-394a-4147-8837-10ec54f855d1';

-- Escopo Renato → LF Serviços (Legado) inteira
INSERT INTO public.hora_extra_lider_escopo (lider_id, tipo, company_id, rotulo)
SELECT l.id, 'EMPRESA', c.id, 'LF Serviços (Legado)'
FROM public.hora_extra_lideres l
CROSS JOIN LATERAL (
  SELECT id FROM public.companies
  WHERE upper(name) LIKE '%LF%' OR upper(name) LIKE '%LEGADO%'
  LIMIT 1
) c
WHERE l.employee_id = '1cdf304d-c746-41af-8f48-3bbdd9dfde3b';

-- =========================================================
-- 6. TRIGGER: quando criarem conta pros líderes, amarrar automaticamente pelo email
-- (roda quando um user_id é setado num profile)
-- =========================================================
CREATE OR REPLACE FUNCTION public.amarrar_lider_novo_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  emp_id uuid;
BEGIN
  -- tenta achar employee pelo email do user novo
  SELECT e.id INTO emp_id
  FROM public.employees e
  WHERE e.email_corporativo IS NOT NULL
    AND lower(e.email_corporativo) = lower((SELECT email FROM auth.users WHERE id = NEW.id))
  LIMIT 1;

  IF emp_id IS NOT NULL THEN
    UPDATE public.hora_extra_lideres
       SET user_id = NEW.id
     WHERE employee_id = emp_id AND user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

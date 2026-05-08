
-- 1. Drop old schema
DROP EVENT TRIGGER IF EXISTS rls_auto_enable_trigger CASCADE;

DO $$ DECLARE r record;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

DO $$ DECLARE r record;
BEGIN
  FOR r IN (SELECT proname, oidvectortypes(proargtypes) AS args
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public') LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
  END LOOP;
END $$;

DO $$ DECLARE r record;
BEGIN
  FOR r IN (SELECT t.typname FROM pg_type t
            JOIN pg_namespace n ON n.oid=t.typnamespace
            WHERE n.nspname='public' AND t.typtype IN ('e','c','d')
              AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname=t.typname AND c.relnamespace=n.oid)) LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END $$;

-- 2. Enum
CREATE TYPE public.app_role AS ENUM ('admin','tst','viewer');

-- 3. updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 4. Tables (create BEFORE functions that reference them)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'CLT',
  cnpj text, encarregado1 text, encarregado2 text, email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  req_aso boolean NOT NULL DEFAULT true,
  req_integra boolean NOT NULL DEFAULT true,
  req_nrs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cpf text, rg text, cnh text, titulo text, endereco text, matricula text,
  admissao date,
  status text NOT NULL DEFAULT 'ATIVO',
  data_aso date, data_integracao date,
  nrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_role ON public.employees(role_id);
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tipo_exame text NOT NULL,
  data_realizacao date NOT NULL,
  data_vencimento date NOT NULL,
  aptidao text NOT NULL DEFAULT 'SIM',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_exams ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_exams_emp ON public.employee_exams(employee_id);

CREATE TABLE public.employee_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  file_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_docs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_docs_emp ON public.employee_docs(employee_id);

CREATE TABLE public.epi_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  item text NOT NULL,
  tamanho text,
  qtd integer NOT NULL DEFAULT 1,
  data_entrega date NOT NULL DEFAULT CURRENT_DATE,
  data_devolucao date,
  ca text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.epi_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_epi_emp ON public.epi_deliveries(employee_id);

CREATE TABLE public.ptes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ptes ENABLE ROW LEVEL SECURITY;

-- 5. Helper functions (after tables exist)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = _user_id AND role IN ('admin','tst'));
$$;

-- 6. RLS POLICIES
CREATE POLICY "profiles_select_all_authed" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "user_roles_select_authed" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_bootstrap_first_admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  );

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','roles','employees','employee_exams','employee_docs','epi_deliveries','ptes']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                   t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()))',
                   t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()))',
                   t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))',
                   t||'_delete', t);
  END LOOP;
END $$;

-- 7. Auth trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-docs','employee-docs', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "employee_docs_read_authed" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_write_editor" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_update_editor" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_delete_admin" ON storage.objects;

CREATE POLICY "employee_docs_read_authed" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'employee-docs');
CREATE POLICY "employee_docs_write_editor" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-docs' AND public.is_editor(auth.uid()));
CREATE POLICY "employee_docs_update_editor" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-docs' AND public.is_editor(auth.uid()));
CREATE POLICY "employee_docs_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'employee-docs' AND public.has_role(auth.uid(),'admin'));

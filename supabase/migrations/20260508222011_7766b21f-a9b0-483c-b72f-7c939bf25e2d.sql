
-- Extend employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS rg_orgao text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS whatsapp_emergencia text,
  ADD COLUMN IF NOT EXISTS nome_contato text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS tipo_cadastro text NOT NULL DEFAULT 'NAO_MEI',
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS data_integracao date;

-- Extend employee_exams
ALTER TABLE public.employee_exams
  ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'Periódico',
  ADD COLUMN IF NOT EXISTS periodicidade_meses integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS anexo_path text;

-- Extend ptes
ALTER TABLE public.ptes
  ADD COLUMN IF NOT EXISTS local text,
  ADD COLUMN IF NOT EXISTS risco text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVA',
  ADD COLUMN IF NOT EXISTS employee_id uuid,
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS data_emissao timestamptz NOT NULL DEFAULT now();

-- Make ptes.created_by nullable so seed/manual inserts via service work; default to auth user
ALTER TABLE public.ptes ALTER COLUMN created_by DROP NOT NULL;

-- Storage policies for employee-docs (private) and avatars (public)
-- Authenticated editors can upload/update/delete in employee-docs and avatars
DO $$ BEGIN
  CREATE POLICY "employee_docs_read_authed" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'employee-docs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "employee_docs_write_editor" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'employee-docs' AND public.is_editor(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "employee_docs_update_editor" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'employee-docs' AND public.is_editor(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "employee_docs_delete_admin" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'employee-docs' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_read_public" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_write_editor" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND public.is_editor(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_update_editor" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND public.is_editor(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_delete_editor" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND public.is_editor(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

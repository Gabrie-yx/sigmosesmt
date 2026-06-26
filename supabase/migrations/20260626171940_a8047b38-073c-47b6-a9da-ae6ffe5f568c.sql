
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees (status);
CREATE INDEX IF NOT EXISTS idx_employees_nome ON public.employees (nome);
CREATE INDEX IF NOT EXISTS idx_saidas_data_created ON public.employee_saidas_expediente (data DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saidas_employee_id ON public.employee_saidas_expediente (employee_id);
CREATE INDEX IF NOT EXISTS idx_saidas_company_id ON public.employee_saidas_expediente (company_id);
CREATE INDEX IF NOT EXISTS idx_documentos_assinados_created ON public.documentos_assinados (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aprs_emissao_numero ON public.aprs (data_emissao DESC, numero DESC);
CREATE INDEX IF NOT EXISTS idx_training_matrix_entries_course ON public.training_matrix_entries (course_id);
CREATE INDEX IF NOT EXISTS idx_employees_role_id ON public.employees (role_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees (company_id);
ANALYZE public.employees;
ANALYZE public.employee_saidas_expediente;
ANALYZE public.documentos_assinados;
ANALYZE public.aprs;
ANALYZE public.training_matrix_entries;

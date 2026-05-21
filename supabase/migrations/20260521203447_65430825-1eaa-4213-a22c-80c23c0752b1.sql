
-- Tabela de arquivos legados de checklist (PDFs mensais escaneados)
CREATE TABLE public.checklist_arquivos_legados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos_moveis(id) ON DELETE CASCADE,
  ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  pdf_path text NOT NULL,
  observacao text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipamento_id, ano, mes)
);

CREATE INDEX idx_checklist_legados_equip ON public.checklist_arquivos_legados(equipamento_id, ano DESC, mes DESC);

ALTER TABLE public.checklist_arquivos_legados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers podem ver arquivos legados"
ON public.checklist_arquivos_legados FOR SELECT
USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editors podem inserir arquivos legados"
ON public.checklist_arquivos_legados FOR INSERT
WITH CHECK (public.is_editor(auth.uid()) AND auth.uid() = uploaded_by);

CREATE POLICY "Editors podem atualizar arquivos legados"
ON public.checklist_arquivos_legados FOR UPDATE
USING (public.is_editor(auth.uid()));

CREATE POLICY "Editors podem deletar arquivos legados"
ON public.checklist_arquivos_legados FOR DELETE
USING (public.is_editor(auth.uid()));

-- Storage policies para a pasta legados/ no bucket checklists-equipamentos
CREATE POLICY "Viewers veem PDFs legados de checklist"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'checklists-equipamentos'
  AND (storage.foldername(name))[1] = 'legados'
  AND public.is_viewer_or_above(auth.uid())
);

CREATE POLICY "Editors fazem upload de PDFs legados"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'checklists-equipamentos'
  AND (storage.foldername(name))[1] = 'legados'
  AND public.is_editor(auth.uid())
);

CREATE POLICY "Editors atualizam PDFs legados"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'checklists-equipamentos'
  AND (storage.foldername(name))[1] = 'legados'
  AND public.is_editor(auth.uid())
);

CREATE POLICY "Editors deletam PDFs legados"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'checklists-equipamentos'
  AND (storage.foldername(name))[1] = 'legados'
  AND public.is_editor(auth.uid())
);

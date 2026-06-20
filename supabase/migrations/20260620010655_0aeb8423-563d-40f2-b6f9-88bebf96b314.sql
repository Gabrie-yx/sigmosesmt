
-- 1. Novos campos em extintores (dados técnicos enriquecidos + status consolidado)
ALTER TABLE public.extintores
  ADD COLUMN IF NOT EXISTS numero_cilindro text,
  ADD COLUMN IF NOT EXISTS qr_inmetro_url text,
  ADD COLUMN IF NOT EXISTS codigo_inmetro text,
  ADD COLUMN IF NOT EXISTS lote_inmetro text,
  ADD COLUMN IF NOT EXISTS classes_fogo text[],
  ADD COLUMN IF NOT EXISTS proxima_manutencao_n2 date,
  ADD COLUMN IF NOT EXISTS proxima_manutencao_n3 date,
  ADD COLUMN IF NOT EXISTS ultima_inspecao_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_status_inspecao text,
  ADD COLUMN IF NOT EXISTS ultima_inspecao_foto_id uuid;

-- 2. Novos campos em extintor_inspecoes_fotos (4 fotos + divergência + checklist completo)
ALTER TABLE public.extintor_inspecoes_fotos
  ADD COLUMN IF NOT EXISTS foto_inmetro_path text,
  ADD COLUMN IF NOT EXISTS foto_extra_path text,
  ADD COLUMN IF NOT EXISTS precisa_revisao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justificativa_divergencia text,
  ADD COLUMN IF NOT EXISTS dados_extraidos jsonb;

-- 3. FK opcional para a última inspeção (sem cascade pra não apagar histórico)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extintores_ultima_inspecao_foto_fk'
  ) THEN
    ALTER TABLE public.extintores
      ADD CONSTRAINT extintores_ultima_inspecao_foto_fk
      FOREIGN KEY (ultima_inspecao_foto_id)
      REFERENCES public.extintor_inspecoes_fotos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Trigger: ao salvar uma inspeção por foto vinculada a um extintor, atualizar status no extintor
CREATE OR REPLACE FUNCTION public.extintor_apos_inspecao_foto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.extintor_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN NEW.precisa_revisao THEN 'PRECISA_REVISAO'
    WHEN NEW.status_geral = 'conforme' THEN 'CONFORME'
    WHEN NEW.status_geral = 'nao_conforme' THEN 'NAO_CONFORME'
    ELSE 'PRECISA_REVISAO'
  END;

  UPDATE public.extintores SET
    ultima_inspecao_em = NEW.inspecionado_em,
    ultimo_status_inspecao = v_status,
    ultima_inspecao_foto_id = NEW.id,
    -- enriquecimento opcional (só preenche se ainda estiver vazio no cadastro)
    numero_cilindro       = COALESCE(numero_cilindro,       NEW.dados_extraidos->>'numero_cilindro'),
    qr_inmetro_url        = COALESCE(qr_inmetro_url,        NEW.dados_extraidos->>'qr_inmetro_url'),
    codigo_inmetro        = COALESCE(codigo_inmetro,        NEW.dados_extraidos->>'codigo_inmetro'),
    lote_inmetro          = COALESCE(lote_inmetro,          NEW.dados_extraidos->>'lote_inmetro'),
    fabricante            = COALESCE(fabricante,            NEW.dados_extraidos->>'fabricante'),
    proxima_manutencao_n2 = COALESCE(proxima_manutencao_n2, NULLIF(NEW.dados_extraidos->>'proxima_manutencao_n2','')::date),
    proxima_manutencao_n3 = COALESCE(proxima_manutencao_n3, NULLIF(NEW.dados_extraidos->>'proxima_manutencao_n3','')::date),
    updated_at = now()
  WHERE id = NEW.extintor_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extintor_apos_inspecao_foto ON public.extintor_inspecoes_fotos;
CREATE TRIGGER trg_extintor_apos_inspecao_foto
AFTER INSERT ON public.extintor_inspecoes_fotos
FOR EACH ROW EXECUTE FUNCTION public.extintor_apos_inspecao_foto();

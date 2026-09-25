ALTER TABLE public.controle_documentos ADD COLUMN IF NOT EXISTS periodicidade_meses integer;
ALTER TABLE public.controle_documentos ADD COLUMN IF NOT EXISTS proxima_gerada_id uuid;

CREATE OR REPLACE FUNCTION public.controle_doc_gerar_proxima()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _base date;
  _novo uuid;
BEGIN
  IF NEW.status = 'RESOLVIDO' AND COALESCE(OLD.status,'') <> 'RESOLVIDO'
     AND COALESCE(NEW.periodicidade_meses,0) > 0 AND NEW.proxima_gerada_id IS NULL THEN
    _base := COALESCE(NEW.data_validade, NEW.prazo, CURRENT_DATE);
    _base := (_base + make_interval(months => NEW.periodicidade_meses))::date;
    INSERT INTO public.controle_documentos
      (titulo, descricao, origem, categoria_id, criticidade, responsavel_id, remetente_nome, remetente_contato,
       tratativa, tags, data_recebimento, data_validade, prazo, dias_alerta, periodicidade_meses, recorrente_id, created_by, status)
    VALUES
      (NEW.titulo, NEW.descricao, NEW.origem, NEW.categoria_id, NEW.criticidade, NEW.responsavel_id, NEW.remetente_nome, NEW.remetente_contato,
       NEW.tratativa, NEW.tags, CURRENT_DATE, _base, _base, NEW.dias_alerta, NEW.periodicidade_meses, NEW.recorrente_id, NEW.created_by, 'RECEBIDO')
    RETURNING id INTO _novo;
    NEW.proxima_gerada_id := _novo;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_controle_doc_gerar_proxima ON public.controle_documentos;
CREATE TRIGGER trg_controle_doc_gerar_proxima BEFORE UPDATE ON public.controle_documentos
FOR EACH ROW EXECUTE FUNCTION public.controle_doc_gerar_proxima();
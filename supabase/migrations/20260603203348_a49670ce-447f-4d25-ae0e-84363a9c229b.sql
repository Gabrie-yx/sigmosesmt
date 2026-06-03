CREATE OR REPLACE FUNCTION public.gerar_nc_de_acidente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo TEXT;
  v_desc TEXT;
  v_sev TEXT;
BEGIN
  -- Só dispara para acidentes registráveis sérios
  IF NEW.tipo NOT IN ('COM_AFASTAMENTO','FATAL') THEN
    RETURN NEW;
  END IF;

  -- Evita duplicidade se já houver NC vinculada a este acidente
  IF EXISTS (
    SELECT 1 FROM public.nao_conformidades
     WHERE pendencia_origem = 'acidentes_trabalho:' || NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  v_sev := CASE WHEN NEW.tipo = 'FATAL' THEN 'ALTA' ELSE 'ALTA' END;

  v_titulo := CASE NEW.tipo
    WHEN 'FATAL' THEN 'Acidente FATAL — ' || COALESCE(NEW.vitima_nome,'vítima não identificada')
    ELSE 'Acidente com afastamento — ' || COALESCE(NEW.vitima_nome,'vítima não identificada')
  END;

  v_desc := 'Acidente registrado em ' || to_char(NEW.data_acidente,'DD/MM/YYYY')
    || CASE WHEN NEW.numero_cat IS NOT NULL THEN ' (CAT ' || NEW.numero_cat || ')' ELSE '' END
    || E'\nLocal: ' || COALESCE(NEW.local_acidente,'-')
    || E'\nParte do corpo: ' || COALESCE(NEW.parte_corpo_atingida,'-')
    || E'\nNatureza da lesão: ' || COALESCE(NEW.natureza_lesao,'-')
    || E'\nDescrição: ' || COALESCE(NEW.descricao,'-')
    || E'\n\nNC aberta automaticamente para investigação (Análise de Causa Raiz) e definição do plano de ação corretivo.';

  INSERT INTO public.nao_conformidades (
    titulo, descricao, origem, pendencia_origem,
    severidade, classificacao, data_identificacao, status, created_by
  ) VALUES (
    v_titulo, v_desc, 'QUASE_ACIDENTE', 'acidentes_trabalho:' || NEW.id::text,
    v_sev, 'Não Conformidade', NEW.data_acidente, 'ABERTA', NEW.created_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_nc_de_acidente ON public.acidentes_trabalho;
CREATE TRIGGER trg_gerar_nc_de_acidente
AFTER INSERT ON public.acidentes_trabalho
FOR EACH ROW
EXECUTE FUNCTION public.gerar_nc_de_acidente();
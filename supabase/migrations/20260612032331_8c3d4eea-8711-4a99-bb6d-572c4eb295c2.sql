ALTER TABLE public.oss_templates ADD COLUMN IF NOT EXISTS cbo TEXT;

CREATE OR REPLACE FUNCTION public.oss_templates_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_hash TEXT;
BEGIN
  v_new_hash := md5(
    coalesce(NEW.descricao_atividades,'') || '|' ||
    coalesce(NEW.riscos_texto,'') || '|' ||
    coalesce(NEW.medidas_preventivas,'') || '|' ||
    coalesce(NEW.epis_obrigatorios,'') || '|' ||
    coalesce(NEW.proibicoes,'') || '|' ||
    coalesce(NEW.procedimentos_emergencia,'') || '|' ||
    coalesce(NEW.risco_fisico,'') || '|' ||
    coalesce(NEW.risco_quimico,'') || '|' ||
    coalesce(NEW.risco_biologico,'') || '|' ||
    coalesce(NEW.risco_ergonomico,'') || '|' ||
    coalesce(NEW.risco_acidente,'') || '|' ||
    coalesce(NEW.risco_psicossocial,'') || '|' ||
    coalesce(NEW.cbo,'')
  );
  IF TG_OP = 'UPDATE' AND OLD.hash_conteudo IS NOT NULL AND OLD.hash_conteudo IS DISTINCT FROM v_new_hash THEN
    NEW.revisao := COALESCE(OLD.revisao, 1) + 1;
  END IF;
  NEW.hash_conteudo := v_new_hash;
  RETURN NEW;
END;
$function$;
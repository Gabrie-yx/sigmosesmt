
-- Onda 1 / Bloco 1 / Item 3 — checagem de permissão em RPCs SECURITY DEFINER
-- Auditoria: várias funções DEFINER estavam com EXECUTE pra anon. A pior
-- (listar_convocacoes_pendentes_supervisor) devolvia lista de líderes e
-- convocações pra qualquer chamador com anon key. Corrigido abaixo.

-- 1) Só supervisor geral pode listar convocações pendentes
CREATE OR REPLACE FUNCTION public.listar_convocacoes_pendentes_supervisor()
 RETURNS TABLE(id uuid, data date, tipo_convocacao text, horario_inicio text, horario_fim text, justificativa text, status text, lider_nome text, qtd_marcados bigint, criado_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_supervisor_geral(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT h.id, h.data, h.tipo_convocacao, h.horario_inicio, h.horario_fim,
         h.justificativa, h.status,
         e.nome,
         (SELECT count(*) FROM public.hora_extra_sabado_funcionarios f WHERE f.hora_extra_id = h.id),
         h.created_at
  FROM public.hora_extra_sabado h
  LEFT JOIN public.hora_extra_lideres l ON l.id = h.lider_id
  LEFT JOIN public.employees e ON e.id = l.employee_id
  WHERE h.status IN ('PENDENTE','APROVADA','INDEFERIDA')
    AND h.lider_id IS NOT NULL
  ORDER BY
    CASE h.status WHEN 'PENDENTE' THEN 0 WHEN 'APROVADA' THEN 1 ELSE 2 END,
    h.data DESC, h.created_at DESC;
END;
$function$;

-- 2) Revogar EXECUTE indevido de anon em funções DEFINER sensíveis / helpers
--    (triggers/helpers não precisam ser chamáveis pelo browser sem login)
REVOKE EXECUTE ON FUNCTION public.listar_convocacoes_pendentes_supervisor() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_lider_extra(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hora_extra_marcador_visivel(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.amarrar_lider_novo_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_hora_extra_physical_delete() FROM anon;

-- 3) Blindar RPCs "só authenticated" contra chamada sem sessão (defesa em profundidade
--    caso alguém futuramente conceda anon ou o JWT vier vazio via mistake de client).
CREATE OR REPLACE FUNCTION public.gerar_numero_apr()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano2 TEXT := to_char(CURRENT_DATE, 'YY');
  v_mes2 TEXT := to_char(CURRENT_DATE, 'MM');
  v_suffix TEXT := v_mes2 || v_ano2;
  v_seq INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(MAX( substring(numero from '^(\d{5})' )::INT ), 0) + 1
    INTO v_seq
    FROM public.aprs
   WHERE numero ~ ('^\d{5}' || v_suffix || '$');
  RETURN lpad(v_seq::TEXT, 5, '0') || v_suffix;
END;
$function$;

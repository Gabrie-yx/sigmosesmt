CREATE OR REPLACE FUNCTION public.listar_convocacoes_extra_lider()
 RETURNS TABLE(id uuid, data date, tipo_convocacao text, horario_inicio text, horario_fim text, justificativa text, status text, motivo_indeferimento text, qtd_marcados bigint, criado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.data, h.tipo_convocacao, h.horario_inicio, h.horario_fim,
         h.justificativa, h.status, h.motivo_indeferimento,
         (SELECT count(*) FROM public.hora_extra_sabado_funcionarios f
            WHERE f.hora_extra_id = h.id AND f.deleted_at IS NULL),
         h.created_at
  FROM public.hora_extra_sabado h
  LEFT JOIN public.hora_extra_lideres l ON l.id = h.lider_id
  WHERE h.deleted_at IS NULL
    AND (
      l.user_id = auth.uid()
      OR h.created_by = auth.uid()
    )
  ORDER BY h.data DESC, h.created_at DESC;
$function$;
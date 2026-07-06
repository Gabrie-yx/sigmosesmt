UPDATE public.hora_extra_sabado
SET deleted_at = now(),
    delete_reason = 'Arquivamento de fichas de julho/2026 a pedido do usuário'
WHERE data >= '2026-07-01' AND data < '2026-08-01' AND deleted_at IS NULL;

UPDATE public.hora_extra_sabado_funcionarios
SET deleted_at = now(),
    delete_reason = 'Arquivamento em cascata — fichas julho/2026'
WHERE hora_extra_id IN (
  SELECT id FROM public.hora_extra_sabado
  WHERE data >= '2026-07-01' AND data < '2026-08-01'
) AND deleted_at IS NULL;
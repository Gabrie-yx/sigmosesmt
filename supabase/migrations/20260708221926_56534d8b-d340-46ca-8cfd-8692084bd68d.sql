-- Limpeza total das convocações de hora extra (pendentes, aprovadas, indeferidas)
-- Soft delete pra preservar histórico de auditoria.
UPDATE public.hora_extra_sabado_funcionarios
SET deleted_at = now()
WHERE deleted_at IS NULL;

UPDATE public.hora_extra_sabado
SET deleted_at = now()
WHERE deleted_at IS NULL;
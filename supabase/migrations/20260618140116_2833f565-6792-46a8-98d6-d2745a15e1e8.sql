
ALTER TABLE public.oss_emissoes
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

CREATE OR REPLACE FUNCTION public.cancelar_os(
  _os_id uuid,
  _motivo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
BEGIN
  IF v_user IS NULL OR NOT public.is_moderator(v_user) THEN
    RAISE EXCEPTION 'Apenas administradores e moderadores podem cancelar Ordens de Serviço';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 20 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 20 caracteres)';
  END IF;

  SELECT status INTO v_status FROM public.oss_emissoes WHERE id = _os_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;
  IF v_status = 'CANCELADO' THEN
    RAISE EXCEPTION 'Esta OS já está cancelada';
  END IF;

  UPDATE public.oss_emissoes
     SET status = 'CANCELADO',
         cancelado_em = now(),
         cancelado_por = v_user,
         motivo_cancelamento = btrim(_motivo),
         observacoes = COALESCE(observacoes, '') ||
           CASE WHEN observacoes IS NULL OR observacoes = '' THEN '' ELSE E'\n' END ||
           '[CANCELADA em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || '] ' || btrim(_motivo),
         updated_at = now()
   WHERE id = _os_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_os(uuid, text) TO authenticated;

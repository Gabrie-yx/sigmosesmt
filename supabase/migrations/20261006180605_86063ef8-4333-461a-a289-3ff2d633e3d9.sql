ALTER TABLE public.aprs
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrada_por uuid,
  ADD COLUMN IF NOT EXISTS encerrada_obs text;

CREATE OR REPLACE FUNCTION public.encerrar_apr(_apr_id uuid, _obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status text;
BEGIN
  IF NOT (public.is_editor(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'tst'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar APR';
  END IF;
  SELECT status INTO v_status FROM public.aprs WHERE id = _apr_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APR não encontrada'; END IF;
  IF v_status NOT IN ('ATIVA','RASCUNHO') THEN
    RAISE EXCEPTION 'Só é possível encerrar APR Ativa ou Rascunho (atual: %)', v_status;
  END IF;
  UPDATE public.aprs
     SET status = 'ENCERRADA', encerrada_em = now(), encerrada_por = auth.uid(),
         encerrada_obs = nullif(trim(coalesce(_obs,'')),''), updated_at = now()
   WHERE id = _apr_id;
END;
$$;
REVOKE ALL ON FUNCTION public.encerrar_apr(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_apr(uuid, text) TO authenticated;
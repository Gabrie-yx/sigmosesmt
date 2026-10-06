ALTER TABLE public.ptes
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrada_por uuid,
  ADD COLUMN IF NOT EXISTS encerrada_obs text;

CREATE OR REPLACE FUNCTION public.encerrar_pt(_pt_id uuid, _obs text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status text;
BEGIN
  IF NOT (public.is_editor(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'tst'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar PT';
  END IF;
  SELECT status INTO v_status FROM public.ptes WHERE id = _pt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PT não encontrada'; END IF;
  IF v_status <> 'ATIVA' THEN
    RAISE EXCEPTION 'Só é possível encerrar PT Ativa (atual: %)', v_status;
  END IF;
  UPDATE public.ptes
     SET status = 'ENCERRADA', encerrada_em = now(), encerrada_por = auth.uid(),
         encerrada_obs = nullif(trim(coalesce(_obs,'')),'')
   WHERE id = _pt_id;
END;
$$;
REVOKE ALL ON FUNCTION public.encerrar_pt(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_pt(uuid, text) TO authenticated;
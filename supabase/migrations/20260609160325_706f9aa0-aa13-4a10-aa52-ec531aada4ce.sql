
CREATE OR REPLACE FUNCTION public.admin_count_user_sessions(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  SELECT COUNT(*) INTO v_count
    FROM auth.sessions
   WHERE user_id = _user_id
     AND (not_after IS NULL OR not_after > now());
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_signout_user(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  WITH deleted AS (
    DELETE FROM auth.sessions WHERE user_id = _user_id RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM deleted;
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_user_sessions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_signout_user(uuid) TO authenticated;

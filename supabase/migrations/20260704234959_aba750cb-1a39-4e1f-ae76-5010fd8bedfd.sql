ALTER TABLE public.user_invites ADD COLUMN IF NOT EXISTS menus text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.apply_pending_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.user_invites%ROWTYPE;
  v_module public.app_module;
  v_menu text;
BEGIN
  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invite.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    FOREACH v_module IN ARRAY v_invite.modules LOOP
      INSERT INTO public.user_module_access (user_id, module, enabled)
      VALUES (NEW.id, v_module, true)
      ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;
    END LOOP;

    IF v_invite.menus IS NOT NULL THEN
      FOREACH v_menu IN ARRAY v_invite.menus LOOP
        INSERT INTO public.user_menu_access (user_id, menu_key, enabled)
        VALUES (NEW.id, v_menu, true)
        ON CONFLICT (user_id, menu_key) DO UPDATE SET enabled = true;
      END LOOP;
    END IF;

    UPDATE public.user_invites SET accepted_at = now() WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$;
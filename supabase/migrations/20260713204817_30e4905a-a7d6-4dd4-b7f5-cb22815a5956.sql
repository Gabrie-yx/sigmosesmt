
-- Tabela de notificações do SESMT (inbox por usuário)
CREATE TABLE IF NOT EXISTS public.sesmt_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,                    -- ex.: 'inspecao_plano_atribuido'
  titulo text NOT NULL,
  corpo text,
  link text,                             -- rota interna para abrir o item
  contexto_tabela text,                  -- ex.: 'inspecao_ncs_planos'
  contexto_id uuid,                      -- id da linha relacionada
  prazo date,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sesmt_notif_user_lida ON public.sesmt_notificacoes (user_id, lida_em);
CREATE INDEX IF NOT EXISTS idx_sesmt_notif_created ON public.sesmt_notificacoes (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesmt_notificacoes TO authenticated;
GRANT ALL ON public.sesmt_notificacoes TO service_role;

ALTER TABLE public.sesmt_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifs"
  ON public.sesmt_notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user updates own notifs"
  ON public.sesmt_notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user deletes own notifs"
  ON public.sesmt_notificacoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "authenticated can insert notifs"
  ON public.sesmt_notificacoes FOR INSERT TO authenticated
  WITH CHECK (true);

-- Trigger: ao criar plano de NC com responsavel_id (employee),
-- notifica o auth.user vinculado, se existir (via employees.user_id se a coluna existir; caso contrário, sem-op)
CREATE OR REPLACE FUNCTION public.notificar_responsavel_plano_inspecao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_nc RECORD;
  v_local text;
BEGIN
  IF NEW.responsavel_id IS NULL THEN RETURN NEW; END IF;

  -- Tenta encontrar user vinculado ao employee (coluna user_id se existir)
  BEGIN
    EXECUTE 'SELECT user_id FROM public.employees WHERE id = $1'
      INTO v_user_id USING NEW.responsavel_id;
  EXCEPTION WHEN undefined_column THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT nc.nr_codigo, nc.nr_item, nc.descricao, i.local_descricao, i.id AS inspecao_id
    INTO v_nc
  FROM public.inspecao_ncs nc
  JOIN public.inspecoes i ON i.id = nc.inspecao_id
  WHERE nc.id = NEW.nc_id;

  v_local := COALESCE(v_nc.local_descricao, 'Inspeção');

  INSERT INTO public.sesmt_notificacoes (
    user_id, tipo, titulo, corpo, link, contexto_tabela, contexto_id, prazo
  ) VALUES (
    v_user_id,
    'inspecao_plano_atribuido',
    'Nova ação atribuída — ' || v_nc.nr_codigo || COALESCE(' ' || v_nc.nr_item, ''),
    NEW.acao || E'\nLocal: ' || v_local,
    '/app/sesmt/inspecoes/' || v_nc.inspecao_id::text,
    'inspecao_ncs_planos',
    NEW.id,
    NEW.prazo
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_plano_inspecao ON public.inspecao_ncs_planos;
CREATE TRIGGER trg_notif_plano_inspecao
  AFTER INSERT ON public.inspecao_ncs_planos
  FOR EACH ROW EXECUTE FUNCTION public.notificar_responsavel_plano_inspecao();

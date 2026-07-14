
ALTER TABLE public.inspecao_ncs_planos
  ADD COLUMN IF NOT EXISTS por_que text,
  ADD COLUMN IF NOT EXISTS como text,
  ADD COLUMN IF NOT EXISTS onde text,
  ADD COLUMN IF NOT EXISTS custo_estimado numeric,
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'MEDIA'
    CHECK (prioridade IN ('CRITICA','ALTA','MEDIA','BAIXA','VERIFICACAO'));

CREATE OR REPLACE FUNCTION public.sync_inspecao_plano_to_5w2h()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_local text;
  v_nr text;
  v_titulo text;
  v_descricao text;
  v_status text;
BEGIN
  SELECT i.empresa_id, i.local_descricao, nc.nr_codigo, nc.descricao
    INTO v_empresa_id, v_local, v_nr, v_descricao
  FROM public.inspecao_ncs nc
  JOIN public.inspecoes i ON i.id = nc.inspecao_id
  WHERE nc.id = NEW.nc_id;

  v_titulo := COALESCE(NULLIF(NEW.acao, ''), 'Ação da NC ' || COALESCE(v_nr, ''));
  v_status := CASE WHEN NEW.encerrada_em IS NOT NULL THEN 'CONCLUIDA' ELSE 'PENDENTE' END;

  INSERT INTO public.plano_acoes (
    inspecao_nc_plano_id, company_id, titulo, descricao, como, onde, custo,
    responsavel_id, responsavel_execucao, quando, data_conclusao,
    status, prioridade, tipo_registro, origem_acao, observacoes, created_by
  ) VALUES (
    NEW.id, v_empresa_id,
    v_titulo,
    COALESCE(NULLIF(NEW.por_que, ''), v_descricao, NEW.acao),
    NEW.como,
    COALESCE(NULLIF(NEW.onde, ''), v_local),
    NEW.custo_estimado,
    NEW.responsavel_id, NEW.responsavel_nome, NEW.prazo,
    CASE WHEN NEW.encerrada_em IS NOT NULL THEN NEW.encerrada_em::date ELSE NULL END,
    v_status,
    CASE NEW.prioridade
      WHEN 'CRITICA' THEN 'CRITICA'
      WHEN 'ALTA' THEN 'ALTA'
      WHEN 'BAIXA' THEN 'BAIXA'
      WHEN 'VERIFICACAO' THEN 'BAIXA'
      ELSE 'MEDIA'
    END,
    'ACAO_CORRETIVA', 'INSPECAO_SST', NEW.observacoes, NEW.criada_por
  )
  ON CONFLICT (inspecao_nc_plano_id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    como = EXCLUDED.como,
    onde = EXCLUDED.onde,
    custo = EXCLUDED.custo,
    responsavel_id = EXCLUDED.responsavel_id,
    responsavel_execucao = EXCLUDED.responsavel_execucao,
    quando = EXCLUDED.quando,
    data_conclusao = EXCLUDED.data_conclusao,
    status = EXCLUDED.status,
    prioridade = EXCLUDED.prioridade,
    observacoes = EXCLUDED.observacoes,
    updated_at = now();

  RETURN NEW;
END;
$$;

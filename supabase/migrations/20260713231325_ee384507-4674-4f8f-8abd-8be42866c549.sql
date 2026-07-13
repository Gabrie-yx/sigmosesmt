
-- 1) Link direto do plano do 5W2H para o plano da NC de inspeção
ALTER TABLE public.plano_acoes
  ADD COLUMN IF NOT EXISTS inspecao_nc_plano_id uuid UNIQUE
    REFERENCES public.inspecao_ncs_planos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS plano_acoes_inspecao_nc_plano_id_idx
  ON public.plano_acoes(inspecao_nc_plano_id);

-- 2) Função de sincronização (INSERT/UPDATE)
CREATE OR REPLACE FUNCTION public.sync_inspecao_plano_to_5w2h()
RETURNS TRIGGER
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
  -- pega empresa e contexto via NC -> inspecao
  SELECT i.empresa_id, i.local_descricao, nc.nr_codigo, nc.descricao
    INTO v_empresa_id, v_local, v_nr, v_descricao
  FROM public.inspecao_ncs nc
  JOIN public.inspecoes i ON i.id = nc.inspecao_id
  WHERE nc.id = NEW.nc_id;

  v_titulo := COALESCE(NULLIF(NEW.acao, ''), 'Ação da NC ' || COALESCE(v_nr, ''));
  v_status := CASE WHEN NEW.encerrada_em IS NOT NULL THEN 'CONCLUIDA' ELSE 'PENDENTE' END;

  INSERT INTO public.plano_acoes (
    inspecao_nc_plano_id, company_id, titulo, descricao, onde,
    responsavel_id, responsavel_execucao, quando, data_conclusao,
    status, prioridade, tipo_registro, origem_acao, observacoes, created_by
  ) VALUES (
    NEW.id, v_empresa_id,
    v_titulo,
    COALESCE(v_descricao, NEW.acao),
    v_local,
    NEW.responsavel_id, NEW.responsavel_nome, NEW.prazo,
    CASE WHEN NEW.encerrada_em IS NOT NULL THEN NEW.encerrada_em::date ELSE NULL END,
    v_status, 'MEDIA', 'ACAO_CORRETIVA', 'INSPECAO_SST', NEW.observacoes, NEW.criada_por
  )
  ON CONFLICT (inspecao_nc_plano_id) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    onde = EXCLUDED.onde,
    responsavel_id = EXCLUDED.responsavel_id,
    responsavel_execucao = EXCLUDED.responsavel_execucao,
    quando = EXCLUDED.quando,
    data_conclusao = EXCLUDED.data_conclusao,
    status = EXCLUDED.status,
    observacoes = EXCLUDED.observacoes,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inspecao_plano_to_5w2h ON public.inspecao_ncs_planos;
CREATE TRIGGER trg_sync_inspecao_plano_to_5w2h
AFTER INSERT OR UPDATE ON public.inspecao_ncs_planos
FOR EACH ROW EXECUTE FUNCTION public.sync_inspecao_plano_to_5w2h();

-- 3) Backfill dos planos de NC de inspeção já existentes
INSERT INTO public.plano_acoes (
  inspecao_nc_plano_id, company_id, titulo, descricao, onde,
  responsavel_id, responsavel_execucao, quando, data_conclusao,
  status, prioridade, tipo_registro, origem_acao, observacoes, created_by
)
SELECT
  p.id,
  i.empresa_id,
  COALESCE(NULLIF(p.acao, ''), 'Ação da NC ' || COALESCE(nc.nr_codigo, '')),
  COALESCE(nc.descricao, p.acao),
  i.local_descricao,
  p.responsavel_id,
  p.responsavel_nome,
  p.prazo,
  CASE WHEN p.encerrada_em IS NOT NULL THEN p.encerrada_em::date ELSE NULL END,
  CASE WHEN p.encerrada_em IS NOT NULL THEN 'CONCLUIDA' ELSE 'PENDENTE' END,
  'MEDIA',
  'ACAO_CORRETIVA',
  'INSPECAO_SST',
  p.observacoes,
  p.criada_por
FROM public.inspecao_ncs_planos p
JOIN public.inspecao_ncs nc ON nc.id = p.nc_id
JOIN public.inspecoes i ON i.id = nc.inspecao_id
LEFT JOIN public.plano_acoes pa ON pa.inspecao_nc_plano_id = p.id
WHERE pa.id IS NULL;

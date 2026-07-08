
-- Enums
CREATE TYPE public.cal_status AS ENUM ('recebido','em_analise','aplicavel','nao_aplicavel','em_tratativa','atendido','monitoramento');
CREATE TYPE public.cal_criticidade AS ENUM ('baixa','media','alta','critica');
CREATE TYPE public.cal_aplicabilidade_valor AS ENUM ('sim','parcial','nao');
CREATE TYPE public.cal_aprovacao_gestor AS ENUM ('pendente','aprovado','rejeitado');
CREATE TYPE public.cal_modulo_impactado AS ENUM (
  'plano_acoes','controle_documentos','procedimentos','dds',
  'pgr','matriz_treinamento','pcmso','contratadas','epi'
);

-- 1) Lotes de importação
CREATE TABLE public.cal_lote_importacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  total_linhas int NOT NULL DEFAULT 0,
  total_importados int NOT NULL DEFAULT 0,
  total_duplicados int NOT NULL DEFAULT 0,
  total_erros int NOT NULL DEFAULT 0,
  mapeamento jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_lote_importacao TO authenticated;
GRANT ALL ON public.cal_lote_importacao TO service_role;
ALTER TABLE public.cal_lote_importacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY cal_lote_read ON public.cal_lote_importacao FOR SELECT TO authenticated USING (true);
CREATE POLICY cal_lote_ins ON public.cal_lote_importacao FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_lote_upd ON public.cal_lote_importacao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_lote_del ON public.cal_lote_importacao FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 2) Requisitos
CREATE TABLE public.cal_requisitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cal text NOT NULL UNIQUE,
  norma text NOT NULL,
  titulo text,
  ementa text NOT NULL,
  texto_legal text,
  orgao text,
  esfera text,
  data_publicacao date,
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  area text,
  criticidade public.cal_criticidade NOT NULL DEFAULT 'media',
  status public.cal_status NOT NULL DEFAULT 'recebido',
  cliente text DEFAULT 'DMN Estaleiro da Amazônia',
  prazo_atendimento date,
  responsavel_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  gestor_area_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  lote_importacao_id uuid REFERENCES public.cal_lote_importacao(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'planilha',
  tags text[] NOT NULL DEFAULT '{}',
  raw_data jsonb,
  fechado_em timestamptz,
  fechado_por uuid REFERENCES auth.users(id),
  observacao_fechamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX cal_req_status_idx ON public.cal_requisitos(status);
CREATE INDEX cal_req_prazo_idx ON public.cal_requisitos(prazo_atendimento);
CREATE INDEX cal_req_norma_idx ON public.cal_requisitos(norma);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_requisitos TO authenticated;
GRANT ALL ON public.cal_requisitos TO service_role;
ALTER TABLE public.cal_requisitos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cal_req_read ON public.cal_requisitos FOR SELECT TO authenticated USING (true);
CREATE POLICY cal_req_ins ON public.cal_requisitos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_req_upd ON public.cal_requisitos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_req_del ON public.cal_requisitos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cal_req_updated BEFORE UPDATE ON public.cal_requisitos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Aplicabilidade
CREATE TABLE public.cal_aplicabilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_id uuid NOT NULL UNIQUE REFERENCES public.cal_requisitos(id) ON DELETE CASCADE,
  sesmt_valor public.cal_aplicabilidade_valor,
  sesmt_justificativa text,
  sesmt_analisado_por uuid REFERENCES auth.users(id),
  sesmt_analisado_em timestamptz,
  sesmt_assinatura_url text,
  gestor_status public.cal_aprovacao_gestor NOT NULL DEFAULT 'pendente',
  gestor_comentario text,
  gestor_aprovado_por uuid REFERENCES auth.users(id),
  gestor_aprovado_em timestamptz,
  gestor_assinatura_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_aplicabilidade TO authenticated;
GRANT ALL ON public.cal_aplicabilidade TO service_role;
ALTER TABLE public.cal_aplicabilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY cal_apl_read ON public.cal_aplicabilidade FOR SELECT TO authenticated USING (true);
CREATE POLICY cal_apl_ins ON public.cal_aplicabilidade FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_apl_upd ON public.cal_aplicabilidade FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_apl_del ON public.cal_aplicabilidade FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cal_apl_updated BEFORE UPDATE ON public.cal_aplicabilidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Impactos em módulos
CREATE TABLE public.cal_impactos_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_id uuid NOT NULL REFERENCES public.cal_requisitos(id) ON DELETE CASCADE,
  modulo public.cal_modulo_impactado NOT NULL,
  ref_id uuid,
  ref_descricao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id),
  UNIQUE (requisito_id, modulo, ref_id)
);
CREATE INDEX cal_imp_req_idx ON public.cal_impactos_modulos(requisito_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_impactos_modulos TO authenticated;
GRANT ALL ON public.cal_impactos_modulos TO service_role;
ALTER TABLE public.cal_impactos_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cal_imp_read ON public.cal_impactos_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY cal_imp_ins ON public.cal_impactos_modulos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_imp_upd ON public.cal_impactos_modulos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_imp_del ON public.cal_impactos_modulos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));

-- 5) Evidências
CREATE TABLE public.cal_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_id uuid NOT NULL REFERENCES public.cal_requisitos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  arquivo_url text NOT NULL,
  arquivo_nome text,
  mime text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX cal_ev_req_idx ON public.cal_evidencias(requisito_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cal_evidencias TO authenticated;
GRANT ALL ON public.cal_evidencias TO service_role;
ALTER TABLE public.cal_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cal_ev_read ON public.cal_evidencias FOR SELECT TO authenticated USING (true);
CREATE POLICY cal_ev_ins ON public.cal_evidencias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_ev_upd ON public.cal_evidencias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY cal_ev_del ON public.cal_evidencias FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor'));

-- 6) Histórico
CREATE TABLE public.cal_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisito_id uuid NOT NULL REFERENCES public.cal_requisitos(id) ON DELETE CASCADE,
  acao text NOT NULL,
  status_anterior public.cal_status,
  status_novo public.cal_status,
  detalhes jsonb,
  autor_id uuid REFERENCES auth.users(id),
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cal_hist_req_idx ON public.cal_historico(requisito_id, created_at DESC);
GRANT SELECT, INSERT ON public.cal_historico TO authenticated;
GRANT ALL ON public.cal_historico TO service_role;
ALTER TABLE public.cal_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY cal_hist_read ON public.cal_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY cal_hist_ins ON public.cal_historico FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger de histórico automático
CREATE OR REPLACE FUNCTION public.cal_requisito_historico_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cal_historico(requisito_id, acao, status_novo, autor_id, detalhes)
    VALUES (NEW.id, 'criou', NEW.status, NEW.created_by, jsonb_build_object('numero_cal', NEW.numero_cal, 'origem', NEW.origem));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.cal_historico(requisito_id, acao, status_anterior, status_novo, autor_id)
    VALUES (NEW.id, 'mudou_status', OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cal_req_historico
AFTER INSERT OR UPDATE OF status ON public.cal_requisitos
FOR EACH ROW EXECUTE FUNCTION public.cal_requisito_historico_trg();

-- Políticas do bucket cal-evidencias (bucket já criado via Storage tool)
CREATE POLICY "cal_ev_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cal-evidencias');
CREATE POLICY "cal_ev_ins_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cal-evidencias'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "cal_ev_upd_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cal-evidencias'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor')));
CREATE POLICY "cal_ev_del_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cal-evidencias'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst') OR public.has_role(auth.uid(),'editor')));

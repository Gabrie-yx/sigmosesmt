
-- Histórico de alterações dos fatores de consumo
CREATE TABLE public.producao_fatores_consumo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fator_id UUID,
  tipo_embarcacao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidade TEXT,
  fator_anterior NUMERIC,
  fator_novo NUMERIC,
  fonte_anterior TEXT,
  fonte_nova TEXT,
  travado_anterior BOOLEAN,
  travado_novo BOOLEAN,
  observacao_anterior TEXT,
  observacao_nova TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('INSERT','UPDATE','DELETE')),
  alterado_por UUID,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.producao_fatores_consumo_historico TO authenticated;
GRANT ALL ON public.producao_fatores_consumo_historico TO service_role;

ALTER TABLE public.producao_fatores_consumo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewer read historico" ON public.producao_fatores_consumo_historico
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "system insert historico" ON public.producao_fatores_consumo_historico
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_fatores_hist_tipo_cat ON public.producao_fatores_consumo_historico (tipo_embarcacao, categoria, alterado_em DESC);

-- Trigger de auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_fatores_consumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.producao_fatores_consumo_historico
      (fator_id, tipo_embarcacao, categoria, unidade,
       fator_anterior, fator_novo, fonte_anterior, fonte_nova,
       travado_anterior, travado_novo, observacao_anterior, observacao_nova,
       acao, alterado_por)
    VALUES
      (NEW.id, NEW.tipo_embarcacao, NEW.categoria, NEW.unidade,
       NULL, NEW.fator_por_ton_aco, NULL, NEW.fonte,
       NULL, NEW.travado, NULL, NEW.observacao,
       'INSERT', auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.fator_por_ton_aco IS DISTINCT FROM NEW.fator_por_ton_aco)
       OR (OLD.fonte IS DISTINCT FROM NEW.fonte)
       OR (OLD.travado IS DISTINCT FROM NEW.travado)
       OR (OLD.observacao IS DISTINCT FROM NEW.observacao)
       OR (OLD.unidade IS DISTINCT FROM NEW.unidade) THEN
      INSERT INTO public.producao_fatores_consumo_historico
        (fator_id, tipo_embarcacao, categoria, unidade,
         fator_anterior, fator_novo, fonte_anterior, fonte_nova,
         travado_anterior, travado_novo, observacao_anterior, observacao_nova,
         acao, alterado_por)
      VALUES
        (NEW.id, NEW.tipo_embarcacao, NEW.categoria, NEW.unidade,
         OLD.fator_por_ton_aco, NEW.fator_por_ton_aco, OLD.fonte, NEW.fonte,
         OLD.travado, NEW.travado, OLD.observacao, NEW.observacao,
         'UPDATE', auth.uid());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.producao_fatores_consumo_historico
      (fator_id, tipo_embarcacao, categoria, unidade,
       fator_anterior, fator_novo, fonte_anterior, fonte_nova,
       travado_anterior, travado_novo, observacao_anterior, observacao_nova,
       acao, alterado_por)
    VALUES
      (OLD.id, OLD.tipo_embarcacao, OLD.categoria, OLD.unidade,
       OLD.fator_por_ton_aco, NULL, OLD.fonte, NULL,
       OLD.travado, NULL, OLD.observacao, NULL,
       'DELETE', auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_fatores_consumo
AFTER INSERT OR UPDATE OR DELETE ON public.producao_fatores_consumo
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_fatores_consumo();

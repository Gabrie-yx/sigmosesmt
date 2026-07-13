
-- 1) Catálogo de itens oficiais das NRs (com prazo sugerido)
CREATE TABLE IF NOT EXISTS public.catalogo_nrs_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nr_codigo text NOT NULL REFERENCES public.catalogo_nrs(codigo) ON UPDATE CASCADE ON DELETE CASCADE,
  item text NOT NULL,
  texto_oficial text NOT NULL,
  prazo_dias_sugerido integer,
  gravidade_sugerida text CHECK (gravidade_sugerida IN ('BAIXO','MODERADO','ALTO','CRITICO')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nr_codigo, item)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_nrs_itens TO authenticated;
GRANT ALL ON public.catalogo_nrs_itens TO service_role;

ALTER TABLE public.catalogo_nrs_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read catalogo_nrs_itens"
  ON public.catalogo_nrs_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/tst manage catalogo_nrs_itens"
  ON public.catalogo_nrs_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tst'));

CREATE TRIGGER trg_catalogo_nrs_itens_updated
  BEFORE UPDATE ON public.catalogo_nrs_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Vincular inspeção a GHE (opcional)
ALTER TABLE public.inspecoes
  ADD COLUMN IF NOT EXISTS ghe_id uuid REFERENCES public.pgr_ghe(id) ON DELETE SET NULL;

-- 3) Vincular NC a item do catálogo (mantém nr_item texto por retrocompat)
ALTER TABLE public.inspecao_ncs
  ADD COLUMN IF NOT EXISTS catalogo_item_id uuid REFERENCES public.catalogo_nrs_itens(id) ON DELETE SET NULL;

-- 4) Prazo sugerido copiado ao plano (só referência informativa)
ALTER TABLE public.inspecao_ncs_planos
  ADD COLUMN IF NOT EXISTS prazo_dias_sugerido integer;

-- 5) Seed inicial dos itens mais operacionais (NR-06, 10, 12, 33, 34, 35)
INSERT INTO public.catalogo_nrs_itens (nr_codigo, item, texto_oficial, prazo_dias_sugerido, gravidade_sugerida) VALUES
  ('NR-06','6.6.1','Cabe ao empregado usar o EPI apenas para a finalidade a que se destina.',7,'MODERADO'),
  ('NR-06','6.7.1','Cabe ao empregador adquirir o EPI adequado ao risco de cada atividade, exigir seu uso e fornecer somente o aprovado (CA).',15,'ALTO'),
  ('NR-06','6.8.1','O EPI só pode ser posto à venda ou utilizado com o Certificado de Aprovação (CA) expedido pelo órgão nacional competente.',15,'ALTO'),
  ('NR-10','10.2.8.2.1','Nas instalações elétricas de alta tensão e nas de baixa tensão, quando existir a possibilidade de exposição a arcos elétricos, os trabalhadores devem utilizar vestimentas condutivas.',30,'CRITICO'),
  ('NR-10','10.4.4','Antes de iniciar trabalhos em instalações elétricas desenergizadas, esta condição deve ser garantida seguindo os procedimentos apropriados (seccionamento, impedimento, constatação, aterramento, sinalização).',7,'CRITICO'),
  ('NR-10','10.6.1','Toda intervenção em instalações elétricas deve ser precedida de ordens de serviço específicas, aprovadas formalmente por autoridade responsável.',15,'ALTO'),
  ('NR-12','12.38','As zonas de perigo das máquinas e equipamentos devem possuir sistemas de segurança, caracterizados por proteções fixas, móveis e dispositivos de segurança interligados.',30,'CRITICO'),
  ('NR-12','12.47','Os componentes de partida, parada, acionamento e controles que compõem a interface de operação das máquinas devem operar em extra baixa tensão de até 25 VCA ou 60 VCC.',60,'ALTO'),
  ('NR-33','33.3.2','Todo trabalho em espaço confinado deve ser precedido de Permissão de Entrada e Trabalho (PET), que garanta o cumprimento das medidas de controle estabelecidas.',3,'CRITICO'),
  ('NR-33','33.3.5.1','O empregador deve providenciar avaliação e monitoramento contínuos da atmosfera nos espaços confinados.',3,'CRITICO'),
  ('NR-33','33.4.1','Antes de adentrar o espaço confinado, o vigia e os trabalhadores autorizados devem verificar a eficácia das medidas de controle.',1,'CRITICO'),
  ('NR-34','34.5.1','Toda atividade envolvendo trabalho a quente deve possuir Permissão de Trabalho (PT) emitida antes do início dos serviços.',3,'CRITICO'),
  ('NR-34','34.11.1','As atividades em altura devem observar o disposto na NR-35 e demais medidas de controle previstas nesta NR.',7,'ALTO'),
  ('NR-34','34.11.6.1','As linhas de vida devem ser projetadas por profissional legalmente habilitado, com ART, atendendo carga mínima de ruptura e ancoragens qualificadas.',15,'CRITICO'),
  ('NR-35','35.4.5','Todo trabalho em altura deve ser precedido de Análise de Risco (AR) e emissão de Permissão de Trabalho (PT).',3,'CRITICO'),
  ('NR-35','35.5.1','Todo trabalhador em altura deve utilizar sistema de proteção contra quedas (SPCQ) apropriado à atividade.',1,'CRITICO'),
  ('NR-35','35.6.2','O empregador deve elaborar Procedimento Operacional para as atividades rotineiras em altura, contendo, no mínimo, as diretrizes e requisitos da tarefa.',30,'ALTO')
ON CONFLICT (nr_codigo, item) DO NOTHING;

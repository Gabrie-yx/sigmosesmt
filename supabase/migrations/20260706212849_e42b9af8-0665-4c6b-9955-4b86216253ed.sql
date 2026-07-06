-- Proteção contra perda definitiva em Hora Extra: soft-delete/arquivamento
ALTER TABLE public.hora_extra_sabado
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

ALTER TABLE public.hora_extra_sabado_funcionarios
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS idx_hora_extra_sabado_not_deleted
  ON public.hora_extra_sabado (data DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hora_extra_func_not_deleted
  ON public.hora_extra_sabado_funcionarios (hora_extra_id, ordem)
  WHERE deleted_at IS NULL;

-- A visualização normal passa a ignorar arquivados
DROP POLICY IF EXISTS "viewers can read hora_extra_sabado" ON public.hora_extra_sabado;
CREATE POLICY "viewers can read hora_extra_sabado"
  ON public.hora_extra_sabado FOR SELECT
  USING (public.is_viewer_or_above(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "extra_sabado_select_marcador" ON public.hora_extra_sabado;
CREATE POLICY "extra_sabado_select_marcador"
  ON public.hora_extra_sabado FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND aberto_marcadores_em IS NOT NULL
    AND (marcadores_expira_em IS NULL OR marcadores_expira_em > now())
    AND EXISTS (
      SELECT 1 FROM public.hora_extra_marcadores m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
  );

DROP POLICY IF EXISTS "viewers can read hora_extra_sabado_funcionarios" ON public.hora_extra_sabado_funcionarios;
CREATE POLICY "viewers can read hora_extra_sabado_funcionarios"
  ON public.hora_extra_sabado_funcionarios FOR SELECT
  USING (public.is_viewer_or_above(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "extra_sabado_func_select_marcador" ON public.hora_extra_sabado_funcionarios;
CREATE POLICY "extra_sabado_func_select_marcador"
  ON public.hora_extra_sabado_funcionarios FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hora_extra_marcadores m
      WHERE m.user_id = auth.uid() AND m.ativo = true
    )
    AND EXISTS (
      SELECT 1 FROM public.hora_extra_sabado h
      WHERE h.id = hora_extra_sabado_funcionarios.hora_extra_id
        AND h.deleted_at IS NULL
        AND h.aberto_marcadores_em IS NOT NULL
        AND (h.marcadores_expira_em IS NULL OR h.marcadores_expira_em > now())
    )
  );

-- Líderes só veem suas convocações ativas na tela normal
CREATE OR REPLACE FUNCTION public.listar_convocacoes_extra_lider()
RETURNS TABLE(id uuid, data date, tipo_convocacao text, horario_inicio text, horario_fim text, justificativa text, status text, motivo_indeferimento text, qtd_marcados bigint, criado_em timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT h.id, h.data, h.tipo_convocacao, h.horario_inicio, h.horario_fim,
         h.justificativa, h.status, h.motivo_indeferimento,
         (SELECT count(*) FROM public.hora_extra_sabado_funcionarios f WHERE f.hora_extra_id = h.id AND f.deleted_at IS NULL),
         h.created_at
  FROM public.hora_extra_sabado h
  JOIN public.hora_extra_lideres l ON l.id = h.lider_id
  WHERE l.user_id = auth.uid()
    AND h.deleted_at IS NULL
  ORDER BY h.data DESC, h.created_at DESC;
$function$;

-- Excluir convocação agora arquiva; não apaga mais do banco
CREATE OR REPLACE FUNCTION public.excluir_convocacao_extra_lider(_hora_extra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec record;
  v_lider record;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_rec FROM public.hora_extra_sabado WHERE id = _hora_extra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convocação não encontrada';
  END IF;

  IF public.has_role(v_uid,'admin') THEN
    NULL;
  ELSE
    SELECT * INTO v_lider FROM public.meu_lider_extra();
    IF v_lider.id IS NULL OR v_lider.id <> v_rec.lider_id THEN
      RAISE EXCEPTION 'Somente o líder que criou pode excluir';
    END IF;
    IF v_rec.status = 'APROVADA' THEN
      RAISE EXCEPTION 'Convocação já aprovada não pode ser excluída pelo líder — fale com o Anderson/Admin';
    END IF;
  END IF;

  UPDATE public.hora_extra_sabado_funcionarios
     SET deleted_at = now(), deleted_by = v_uid, delete_reason = 'Arquivada junto com a convocação'
   WHERE hora_extra_id = _hora_extra_id
     AND deleted_at IS NULL;

  UPDATE public.hora_extra_sabado
     SET deleted_at = now(), deleted_by = v_uid, delete_reason = 'Arquivada pelo fluxo de exclusão; histórico preservado'
   WHERE id = _hora_extra_id
     AND deleted_at IS NULL;
END;
$function$;

-- Desmarcar funcionário agora arquiva a linha, preservando histórico
CREATE OR REPLACE FUNCTION public.desmarcar_funcionario_sabado(_row_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_row record;
  v_permitido boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT * INTO v_row FROM public.hora_extra_sabado_funcionarios WHERE id = _row_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;

  IF NOT v_admin THEN
    SELECT (
      EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
      OR EXISTS(SELECT 1 FROM public.hora_extra_lideres WHERE user_id = v_uid AND ativo = true)
    ) INTO v_permitido;
    IF NOT v_permitido THEN RAISE EXCEPTION 'Sem permissão'; END IF;
    IF v_row.marcado_por IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Só quem marcou pode desmarcar';
    END IF;
  END IF;

  UPDATE public.hora_extra_sabado_funcionarios
     SET deleted_at = now(), deleted_by = v_uid, delete_reason = 'Desmarcado pelo usuário; histórico preservado'
   WHERE id = _row_id
     AND deleted_at IS NULL;
END;
$function$;

-- Evita duplicidade ao remarcar funcionário: se estava arquivado, reativa
CREATE OR REPLACE FUNCTION public.marcar_funcionario_sabado(_hora_extra_id uuid, _employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_permitido boolean;
  v_conv record;
  v_marc_nome text;
  v_max_ordem int;
  v_row_id uuid;
  v_emp record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_admin := public.pode_gerir_extra_sabado(v_uid);
  SELECT (
    EXISTS(SELECT 1 FROM public.hora_extra_marcadores WHERE user_id = v_uid AND ativo = true)
    OR EXISTS(SELECT 1 FROM public.hora_extra_lideres WHERE user_id = v_uid AND ativo = true)
  ) INTO v_permitido;
  IF NOT (v_admin OR v_permitido) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO v_conv FROM public.hora_extra_sabado WHERE id = _hora_extra_id AND deleted_at IS NULL FOR UPDATE;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Convocação não encontrada'; END IF;

  IF v_conv.status = 'INDEFERIDA' THEN
    RAISE EXCEPTION 'Convocação indeferida — não é possível marcar';
  END IF;

  SELECT id, nome, funcao INTO v_emp FROM public.employees WHERE id = _employee_id;
  IF v_emp.id IS NULL THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;

  IF NOT v_admin THEN
    IF NOT public.hora_extra_marcador_pode_marcar(v_uid, _employee_id) THEN
      RAISE EXCEPTION 'Funcionário fora do seu escopo';
    END IF;
  END IF;

  SELECT full_name INTO v_marc_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.hora_extra_sabado_funcionarios
     SET deleted_at = NULL,
         deleted_by = NULL,
         delete_reason = NULL,
         marcado_por = v_uid,
         marcado_por_nome = COALESCE(v_marc_nome, auth.email()),
         marcado_em = now(),
         transporte = true,
         alimentacao = true
   WHERE hora_extra_id = _hora_extra_id
     AND employee_id = _employee_id
  RETURNING id INTO v_row_id;

  IF v_row_id IS NOT NULL THEN
    RETURN v_row_id;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_max_ordem
  FROM public.hora_extra_sabado_funcionarios
  WHERE hora_extra_id = _hora_extra_id;

  INSERT INTO public.hora_extra_sabado_funcionarios
    (hora_extra_id, employee_id, nome, externo, funcao, transporte, alimentacao, ordem, marcado_por, marcado_por_nome, marcado_em)
  VALUES
    (_hora_extra_id, _employee_id, v_emp.nome, false, v_emp.funcao, true, true, v_max_ordem, v_uid, COALESCE(v_marc_nome, auth.email()), now())
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$function$;

-- Recuperação dos registros de junho a partir dos PDFs anexados
DO $restore$
DECLARE
  v_ficha_id uuid;
  v_empresa_id uuid;
  v_employee_id uuid;
  r record;
BEGIN
  CREATE TEMP TABLE tmp_hora_extra_restore (
    data date,
    horario_inicio text,
    horario_fim text,
    setor text,
    empresa_nome text,
    modulo_origem text,
    ordem int,
    nome text,
    transporte boolean,
    alimentacao boolean
  ) ON COMMIT DROP;

  INSERT INTO tmp_hora_extra_restore VALUES
  ('2026-06-13','07:30','15:00','Produção, Administrativo','DMN','terceirizadas',1,'Jefeston Nascimento de Figueiredo',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','DMN','terceirizadas',2,'Renato Oliveira Barbosa',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','DMN','terceirizadas',3,'Israel Uchoa Rengifo',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','DMN','terceirizadas',4,'Francisco Bandeira Almeida',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','DMN','terceirizadas',5,'Natanael Marins de Lira',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','DMN','terceirizadas',6,'Leonardo Carmo dos Santos',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','EZ DESENVOLVIMENTO','terceirizadas',1,'Mizael Ribeiro do Nascimento',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','EZ DESENVOLVIMENTO','terceirizadas',2,'Randolf Pacheco',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','EZ DESENVOLVIMENTO','terceirizadas',3,'Diego de Oliveira da Silva',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','EZ DESENVOLVIMENTO','terceirizadas',4,'Renan Caldeira Pinto',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','EZ DESENVOLVIMENTO','terceirizadas',5,'Flavio Alves Barros Junior',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','EZ DESENVOLVIMENTO','terceirizadas',6,'Marvin Garcia',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',1,'Adriano dos Santos Geronimo',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',2,'Emilson dos Nascimento da Silva',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',3,'Adailson Ferraz Pereira',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',4,'Alex Manuel Veloso da Silva',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',5,'Hudson Tavares da Silva',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',6,'Edenilson Gaiay Ramos',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','LF SERVIÇOS DE  MANUTENÇÃO LTDA','terceirizadas',1,'Kleber Lucas Lima Firmino',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','MEI - Prestadores','terceirizadas',1,'Adailson Nascimento de Carvalho',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','MEI - Prestadores','terceirizadas',2,'Ana Silvia Barroso dos Santos',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',1,'Caio dos Santos Leite',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',2,'Fábio de França',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',3,'Anailton Batista Lopes',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',4,'Aiton Rolim Souza',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',5,'Adalberto Ramos Gomes',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',6,'Giovani dos Santos Souza',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',7,'Janderson Gomes da Cruz',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','NB CONSTRUÇÃO','terceirizadas',8,'Vânia Ferreira Nogueira',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','PORTARIA','terceirizadas',1,'Altair Silva da Costa',true,true),
  ('2026-06-13','07:30','15:00','Produção, Administrativo','PORTARIA','terceirizadas',2,'Vanderlan dos Santos Meireles',true,true),

  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',1,'Anderson de Oliveira Soares',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',2,'Daniel Oliveira de Abreu',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',3,'Francisco Bandeira Almeida',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',4,'Israel Uchoa Rengifo',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',5,'Jefeston Nascimento de Figueiredo',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',6,'Leonardo Carmo dos Santos',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',7,'Manoel da Silva de Souza',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',8,'Natanael Marins de Lira',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',9,'Renato Oliveira Barbosa',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','EZ DESENVOLVIMENTO','terceirizadas',1,'Diego de Oliveira da Silva',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','EZ DESENVOLVIMENTO','terceirizadas',2,'Flavio Alves Barros Junior',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','EZ DESENVOLVIMENTO','terceirizadas',3,'Gilmar Jones dos Santos Zaranza',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','EZ DESENVOLVIMENTO','terceirizadas',4,'Marvin Garcia',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',1,'Alex Manuel Veloso da Silva',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',2,'Eglison Oliveira Ferreira',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',3,'Edenilson Gaiay Ramos',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',4,'Hudson Tavares da Silva',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',5,'Jeivisson Barroso Rabelo',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',6,'Jose Carlos Silva Galvão',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','LF SERVIÇOS DE  MANUTENÇÃO LTDA','terceirizadas',1,'Kleber Lucas Lima Firmino',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','MEI - Prestadores','terceirizadas',1,'Adailson Nascimento de Carvalho',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','MEI - Prestadores','terceirizadas',2,'Ana Silvia Barroso dos Santos',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','MEI - Prestadores','terceirizadas',3,'Giovanni dos Santos',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','MEI - Prestadores','terceirizadas',4,'Manoel Raimundo Oliveira de Souza',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',1,'Adalberto Ramos Gomes',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',2,'Adriano Barbosa de Almeida',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',3,'Aiton Rolim Souza',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',4,'Gideão Lucas de Sousa Ferreira',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',5,'Jailson Farias de Souza',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',6,'Janderlei Souza Ramos',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',7,'Janderson Araújo Batista',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',8,'Janderson Gomes da Cruz',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','PORTARIA','terceirizadas',1,'Gabriel Aguiar da Cruz',true,true),
  ('2026-06-20','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','PORTARIA','terceirizadas',2,'Kaique Pereira da Silva',true,true),

  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',1,'Daniel Oliveira de Abreu',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',2,'Francisco Bandeira Almeida',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',3,'Israel Uchoa Rengifo',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',4,'Jefeston Nascimento de Figueiredo',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',5,'Leonardo Carmo dos Santos',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',6,'Manoel da Silva de Souza',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',7,'Natanael Marins de Lira',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',8,'Paulo Sergio de Souza Silva',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',9,'Renato Oliveira Barbosa',true,true),
  ('2026-06-27','07:30','15:00','Produção','DMN','terceirizadas',10,'William de Oliveira Lima',true,true),
  ('2026-06-27','07:30','15:00','Produção','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',1,'Adailson Ferraz Pereira',true,true),
  ('2026-06-27','07:30','15:00','Produção','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',2,'Adriano dos Santos Geronimo',true,true),
  ('2026-06-27','07:30','15:00','Produção','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',3,'Alex Manuel Veloso da Silva',true,true),
  ('2026-06-27','07:30','15:00','Produção','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',4,'Eglison Oliveira Ferreira',true,true),
  ('2026-06-27','07:30','15:00','Produção','MEI - Prestadores','terceirizadas',1,'Adailson Nascimento de Carvalho',true,true),
  ('2026-06-27','07:30','15:00','Produção','MEI - Prestadores','terceirizadas',2,'Ana Silvia Barroso dos Santos',true,true),
  ('2026-06-27','07:30','15:00','Produção','MEI - Prestadores','terceirizadas',3,'Giovanni dos Santos',true,true),
  ('2026-06-27','07:30','15:00','Produção','MEI - Prestadores','terceirizadas',4,'Manoel Raimundo Oliveira de Souza',true,true),
  ('2026-06-27','07:30','15:00','Produção','NB CONSTRUÇÃO','terceirizadas',1,'Adalberto Ramos Gomes',true,true),
  ('2026-06-27','07:30','15:00','Produção','NB CONSTRUÇÃO','terceirizadas',2,'Adriano Barbosa de Almeida',true,true),
  ('2026-06-27','07:30','15:00','Produção','NB CONSTRUÇÃO','terceirizadas',3,'Aiton Rolim Souza',true,true),
  ('2026-06-27','07:30','15:00','Produção','PORTARIA','terceirizadas',1,'Altair Silva da Costa',true,true),
  ('2026-06-27','07:30','15:00','Produção','PORTARIA','terceirizadas',2,'Vanderlan dos Santos Meireles',true,true);

  FOR r IN
    SELECT data, horario_inicio, horario_fim, setor, empresa_nome, modulo_origem
    FROM tmp_hora_extra_restore
    GROUP BY data, horario_inicio, horario_fim, setor, empresa_nome, modulo_origem
    ORDER BY data, empresa_nome
  LOOP
    SELECT id INTO v_empresa_id
    FROM public.companies
    WHERE lower(unaccent(name)) = lower(unaccent(r.empresa_nome))
       OR lower(unaccent(name)) ILIKE lower(unaccent(r.empresa_nome || '%'))
       OR lower(unaccent(r.empresa_nome)) ILIKE lower(unaccent(name || '%'))
    ORDER BY CASE WHEN lower(unaccent(name)) = lower(unaccent(r.empresa_nome)) THEN 0 ELSE 1 END, name
    LIMIT 1;

    SELECT id INTO v_ficha_id
    FROM public.hora_extra_sabado
    WHERE data = r.data
      AND horario_inicio = r.horario_inicio
      AND horario_fim = r.horario_fim
      AND coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND modulo_origem = r.modulo_origem
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_ficha_id IS NULL THEN
      INSERT INTO public.hora_extra_sabado (
        data, turno, horario_inicio, horario_fim, setor, centro_custo, tipo_efetivo, company_id,
        observacao, justificativa, status, tipo_convocacao, modulo_origem,
        assinatura_tst_data, assinatura_gestor_data, criado_automatico, criado_automatico_por_nome,
        created_at, updated_at
      ) VALUES (
        r.data, '1º', r.horario_inicio, r.horario_fim, r.setor, NULL, 'DMN', v_empresa_id,
        'Registro recuperado de PDF anexado após perda de histórico.',
        'Recuperado de PDF de hora extra de junho/2026.',
        'APROVADA', 'SABADO', r.modulo_origem,
        'Recuperado de PDF', 'Recuperado de PDF', true, 'Lovable - recuperação emergencial',
        now(), now()
      ) RETURNING id INTO v_ficha_id;
    END IF;

    FOR r IN
      SELECT * FROM tmp_hora_extra_restore t
      WHERE t.data = r.data
        AND t.horario_inicio = r.horario_inicio
        AND t.horario_fim = r.horario_fim
        AND t.empresa_nome = r.empresa_nome
        AND t.modulo_origem = r.modulo_origem
      ORDER BY ordem
    LOOP
      SELECT e.id INTO v_employee_id
      FROM public.employees e
      WHERE lower(unaccent(e.nome)) = lower(unaccent(r.nome))
      ORDER BY CASE WHEN e.company_id = v_empresa_id THEN 0 ELSE 1 END
      LIMIT 1;

      IF v_employee_id IS NULL THEN
        SELECT e.id INTO v_employee_id
        FROM public.employees e
        WHERE lower(unaccent(e.nome)) ILIKE lower(unaccent('%' || r.nome || '%'))
           OR lower(unaccent(r.nome)) ILIKE lower(unaccent('%' || e.nome || '%'))
        ORDER BY CASE WHEN e.company_id = v_empresa_id THEN 0 ELSE 1 END, e.nome
        LIMIT 1;
      END IF;

      INSERT INTO public.hora_extra_sabado_funcionarios (
        hora_extra_id, employee_id, nome, externo, funcao, transporte, alimentacao, presenca, ordem, created_at, marcado_em
      ) VALUES (
        v_ficha_id, v_employee_id, r.nome, v_employee_id IS NULL, NULL, r.transporte, r.alimentacao, NULL, r.ordem, now(), now()
      )
      ON CONFLICT DO NOTHING;

      v_employee_id := NULL;
    END LOOP;

    v_ficha_id := NULL;
    v_empresa_id := NULL;
  END LOOP;
END;
$restore$;
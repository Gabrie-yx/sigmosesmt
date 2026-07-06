-- Trava final: ninguém apaga fisicamente registros de hora extra pelo app/API
CREATE OR REPLACE FUNCTION public.prevent_hora_extra_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Exclusão definitiva bloqueada: registros de hora extra devem ser arquivados para preservar histórico.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_delete_hora_extra_sabado_funcionarios ON public.hora_extra_sabado_funcionarios;
CREATE TRIGGER trg_prevent_delete_hora_extra_sabado_funcionarios
  BEFORE DELETE ON public.hora_extra_sabado_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hora_extra_physical_delete();

DROP TRIGGER IF EXISTS trg_prevent_delete_hora_extra_sabado ON public.hora_extra_sabado;
CREATE TRIGGER trg_prevent_delete_hora_extra_sabado
  BEFORE DELETE ON public.hora_extra_sabado
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hora_extra_physical_delete();

-- Fecha a porta via RLS também: sem DELETE direto por cliente
DROP POLICY IF EXISTS "admin can delete hora_extra_sabado" ON public.hora_extra_sabado;
DROP POLICY IF EXISTS "criador pode excluir hora_extra pendente ou indeferida" ON public.hora_extra_sabado;
DROP POLICY IF EXISTS "editors can delete hora_extra_sabado_funcionarios" ON public.hora_extra_sabado_funcionarios;

-- Completa/corrige o PDF de 27/06/2026
DO $restore_27$
DECLARE
  v_ficha_id uuid;
  v_empresa_id uuid;
  v_employee_id uuid;
  g record;
  r record;
BEGIN
  CREATE TEMP TABLE tmp_hora_extra_restore_27 (
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

  INSERT INTO tmp_hora_extra_restore_27 VALUES
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','DMN','terceirizadas',9,'Wilson Conceicao de Almeida',true,true),

  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',5,'Anderson dos Santos Rodrigues',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',6,'Antonio Andrio Moura dos Santos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',7,'Antônio Gildo Januário',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',8,'Chrystian Andrade Morae',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',9,'Claudino Alexandre da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',10,'Clóvis Mendes Sarmento',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',11,'David de Souza de Oliveira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',12,'Edenilson Gaiay Ramos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',13,'Eglison Oliveira Ferreira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',14,'Eliezio Rodrigues de Oliveira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',15,'Emilson dos Nascimento da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',16,'Erivando Gonçalves de Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',17,'Gelcimar Ferreira Gonçalves',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',18,'Gerinaldo Souza Paz',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',19,'Hudson Tavares da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',20,'Jeivisson Barroso Rabelo',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',21,'Jose Carlos Silva Galvão',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',22,'Jose Geone Gonçalves da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',23,'Júlio Pinto Reca',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',24,'Maciel Reis Santos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',25,'Madson Ferreira Campos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',26,'Marcio Adrian de Assis Farias',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',27,'Natanel dos Santos Assis',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',28,'Paulo Cesar Cruz de Lima',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',29,'Rafael Pinto dos Santos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',30,'Raifran Gonçalves de Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',31,'Rodrigo Batalha da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',32,'Tiago Santos de Jesus',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',33,'Wellington Leite Nascimento',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','JC GALVÃO CONSTRUÇÃO E REPARO NAVAL','terceirizadas',34,'Wesley dos Santos Pereira',true,true),

  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',4,'Aiton Rolim Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',5,'Alexandre de Souza Francisco',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',6,'Anailton Batista Lopes',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',7,'Arlem da Silva Santos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',8,'Bruna Gomes de Castro',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',9,'Bruno Mergulhão da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',10,'Caio dos Santos Leite',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',11,'Diego de Oliveira Dias',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',12,'Ediberto Ramos Gomes',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',13,'Ednaldo Ferreira de Sousa',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',14,'Eduardo Costa de Oliveira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',15,'Fábio de França',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',16,'Felipe Luciano Martins',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',17,'Francisco Nascimento Soares',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',18,'Francisco Nisberto da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',19,'Gideão Lucas de Sousa Ferreira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',20,'Jailson Farias de Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',21,'Janderlei Souza Ramos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',22,'Janderson Araújo Batista',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',23,'Janderson Gomes da Cruz',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',24,'Jefter Bruno Santos dos Santos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',25,'João Carlos Coutinho',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',26,'João Vitor dos Santos Maia',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',27,'Kaio Martins Mota Picanço',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',28,'Kleyson Aires da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',29,'Lucas Silva de Oliveira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',30,'Luiz Vitor da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',31,'Marcos André Lima',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',32,'Mateus Gomes Vieira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',33,'Mateus Santos de Oliveira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',34,'Moisés Alves de Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',35,'Nalberthe Duarte',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',36,'Oséias Ferrreira Marques',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',37,'Paulo Carvalho de Melo',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',38,'Railson Campos',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',39,'Railson Lima da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',40,'Raimundo Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',41,'Richardson Moreira da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',42,'Rodrigo Pereira do Rosário',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',43,'Romilson Reges de Oliveira',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',44,'Suvestri da Silva Souza',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',45,'Valdir Rodrigues da Silva',true,true),
  ('2026-06-27','07:30','15:00','Administrativo, Almoxarifado, Manutenção, Produção, SESMT','NB CONSTRUÇÃO','terceirizadas',46,'Vânia Ferreira Nogueira',true,true);

  -- Corrige linha inserida por engano na primeira recuperação: não consta no PDF 27/06 DMN
  UPDATE public.hora_extra_sabado_funcionarios f
     SET deleted_at = now(), deleted_by = NULL, delete_reason = 'Arquivado na correção da recuperação: nome não consta no PDF de 27/06/2026 DMN.'
    FROM public.hora_extra_sabado h
    JOIN public.companies c ON c.id = h.company_id
   WHERE f.hora_extra_id = h.id
     AND h.data = DATE '2026-06-27'
     AND c.name = 'DMN'
     AND f.nome = 'Paulo Sergio de Souza Silva'
     AND f.deleted_at IS NULL;

  -- Ajusta setor dos grupos já criados em 27/06
  UPDATE public.hora_extra_sabado
     SET setor = 'Administrativo, Almoxarifado, Manutenção, Produção, SESMT', updated_at = now()
   WHERE data = DATE '2026-06-27'
     AND horario_inicio = '07:30'
     AND horario_fim = '15:00'
     AND modulo_origem = 'terceirizadas'
     AND deleted_at IS NULL;

  FOR g IN
    SELECT data, horario_inicio, horario_fim, setor, empresa_nome, modulo_origem
    FROM tmp_hora_extra_restore_27
    GROUP BY data, horario_inicio, horario_fim, setor, empresa_nome, modulo_origem
    ORDER BY empresa_nome
  LOOP
    SELECT id INTO v_empresa_id
    FROM public.companies
    WHERE lower(unaccent(name)) = lower(unaccent(g.empresa_nome))
       OR lower(unaccent(name)) ILIKE lower(unaccent(g.empresa_nome || '%'))
       OR lower(unaccent(g.empresa_nome)) ILIKE lower(unaccent(name || '%'))
    ORDER BY CASE WHEN lower(unaccent(name)) = lower(unaccent(g.empresa_nome)) THEN 0 ELSE 1 END, name
    LIMIT 1;

    SELECT id INTO v_ficha_id
    FROM public.hora_extra_sabado
    WHERE data = g.data
      AND horario_inicio = g.horario_inicio
      AND horario_fim = g.horario_fim
      AND coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND modulo_origem = g.modulo_origem
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_ficha_id IS NULL THEN
      INSERT INTO public.hora_extra_sabado (
        data, turno, horario_inicio, horario_fim, setor, tipo_efetivo, company_id,
        observacao, justificativa, status, tipo_convocacao, modulo_origem,
        assinatura_tst_data, assinatura_gestor_data, criado_automatico, criado_automatico_por_nome,
        created_at, updated_at
      ) VALUES (
        g.data, '1º', g.horario_inicio, g.horario_fim, g.setor, 'DMN', v_empresa_id,
        'Registro recuperado de PDF anexado após perda de histórico.',
        'Recuperado de PDF de hora extra de junho/2026.',
        'APROVADA', 'SABADO', g.modulo_origem,
        'Recuperado de PDF', 'Recuperado de PDF', true, 'Lovable - recuperação emergencial',
        now(), now()
      ) RETURNING id INTO v_ficha_id;
    END IF;

    FOR r IN
      SELECT * FROM tmp_hora_extra_restore_27 t
      WHERE t.data = g.data
        AND t.horario_inicio = g.horario_inicio
        AND t.horario_fim = g.horario_fim
        AND t.empresa_nome = g.empresa_nome
        AND t.modulo_origem = g.modulo_origem
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

      -- Se uma linha já existia arquivada por correção anterior, reativa somente se consta no PDF atual.
      UPDATE public.hora_extra_sabado_funcionarios
         SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
       WHERE hora_extra_id = v_ficha_id
         AND nome = r.nome;

      v_employee_id := NULL;
    END LOOP;

    v_ficha_id := NULL;
    v_empresa_id := NULL;
  END LOOP;
END;
$restore_27$;
REVOKE EXECUTE ON FUNCTION public.prevent_hora_extra_physical_delete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_hora_extra_physical_delete() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_hora_extra_physical_delete() TO service_role;

DO $fix_missing$
DECLARE
  v_ficha_id uuid;
  v_employee_id uuid;
BEGIN
  -- JC GALVÃO 27/06: inserir Amadeu e reposicionar Eglison para a ordem correta do PDF
  SELECT h.id INTO v_ficha_id
  FROM public.hora_extra_sabado h
  JOIN public.companies c ON c.id = h.company_id
  WHERE h.data = DATE '2026-06-27'
    AND c.name = 'JC GALVÃO CONSTRUÇÃO E REPARO NAVAL'
    AND h.deleted_at IS NULL
  LIMIT 1;

  IF v_ficha_id IS NOT NULL THEN
    SELECT id INTO v_employee_id FROM public.employees WHERE lower(unaccent(nome)) = lower(unaccent('Amadeu da Silva Ramos')) LIMIT 1;
    INSERT INTO public.hora_extra_sabado_funcionarios (hora_extra_id, employee_id, nome, externo, transporte, alimentacao, ordem, created_at, marcado_em)
    VALUES (v_ficha_id, v_employee_id, 'Amadeu da Silva Ramos', v_employee_id IS NULL, true, true, 4, now(), now())
    ON CONFLICT DO NOTHING;

    UPDATE public.hora_extra_sabado_funcionarios
       SET ordem = 13
     WHERE hora_extra_id = v_ficha_id
       AND nome = 'Eglison Oliveira Ferreira'
       AND deleted_at IS NULL;
  END IF;

  -- NB CONSTRUÇÃO 27/06: inserir Adjalmo e reposicionar Aiton para a ordem correta do PDF
  v_ficha_id := NULL;
  v_employee_id := NULL;

  SELECT h.id INTO v_ficha_id
  FROM public.hora_extra_sabado h
  JOIN public.companies c ON c.id = h.company_id
  WHERE h.data = DATE '2026-06-27'
    AND c.name = 'NB CONSTRUÇÃO'
    AND h.deleted_at IS NULL
  LIMIT 1;

  IF v_ficha_id IS NOT NULL THEN
    SELECT id INTO v_employee_id FROM public.employees WHERE lower(unaccent(nome)) = lower(unaccent('Adjalmo Pereira Franco')) LIMIT 1;
    INSERT INTO public.hora_extra_sabado_funcionarios (hora_extra_id, employee_id, nome, externo, transporte, alimentacao, ordem, created_at, marcado_em)
    VALUES (v_ficha_id, v_employee_id, 'Adjalmo Pereira Franco', v_employee_id IS NULL, true, true, 2, now(), now())
    ON CONFLICT DO NOTHING;

    UPDATE public.hora_extra_sabado_funcionarios
       SET ordem = 4
     WHERE hora_extra_id = v_ficha_id
       AND nome = 'Aiton Rolim Souza'
       AND deleted_at IS NULL;
  END IF;
END;
$fix_missing$;
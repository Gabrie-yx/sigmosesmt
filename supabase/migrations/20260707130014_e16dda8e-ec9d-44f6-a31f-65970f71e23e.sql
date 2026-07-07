
ALTER TABLE public.desligamento_pacotes
  ADD COLUMN IF NOT EXISTS regularizacao boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.v_desligados_sem_pacote AS
SELECT
  e.id                    AS employee_id,
  e.nome,
  e.cpf,
  e.matricula,
  e.company_id,
  e.role_id,
  e.data_desligamento,
  e.motivo_desligamento,
  e.foto_url,
  (SELECT count(*) FROM public.desligamento_pacotes p
      WHERE p.employee_id = e.id AND p.status = 'EMITIDO') AS pacotes_emitidos,
  (SELECT count(*) FROM public.desligamento_pacotes p
      WHERE p.employee_id = e.id AND p.status = 'RASCUNHO') AS pacotes_rascunho
FROM public.employees e
WHERE e.status = 'DESLIGADO'
  AND NOT EXISTS (
    SELECT 1 FROM public.desligamento_pacotes p
     WHERE p.employee_id = e.id AND p.status = 'EMITIDO'
  );

GRANT SELECT ON public.v_desligados_sem_pacote TO authenticated;

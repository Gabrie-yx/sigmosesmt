DROP VIEW IF EXISTS public.v_termos_consentimento_status;

CREATE VIEW public.v_termos_consentimento_status
WITH (security_invoker = true) AS
SELECT
  e.id AS employee_id,
  e.nome,
  e.company_id,
  e.assinatura_url,
  e.termo_consentimento_id,
  e.termo_consentimento_data,
  t.versao_termo,
  t.modalidade,
  t.consente_imagem,
  CASE
    WHEN e.termo_consentimento_id IS NULL THEN 'PENDENTE_TERMO'::text
    WHEN COALESCE(t.versao_termo, 1) < 2 THEN 'TERMO_DESATUALIZADO'::text
    ELSE 'BLINDADO'::text
  END AS status_probatorio
FROM public.employees e
LEFT JOIN public.assinaturas_termos_consentimento t
  ON t.id = e.termo_consentimento_id
WHERE e.status = 'ATIVO'::text;

GRANT SELECT ON public.v_termos_consentimento_status TO authenticated;
GRANT ALL ON public.v_termos_consentimento_status TO service_role;
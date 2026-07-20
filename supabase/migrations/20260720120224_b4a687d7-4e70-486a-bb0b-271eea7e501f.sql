-- Limpa termo órfão do Izael Xavier (linha existe em assinaturas_termos_consentimento mas employee.termo_consentimento_id está null, PDF antigo tem CPF errado)
DELETE FROM public.assinaturas_termos_consentimento
WHERE id = '47954439-f163-4ed5-8ddd-53473f56bdc7'
  AND employee_id = 'a0d7d560-2881-4935-9248-0ad4f7a33872';
-- 1) Estornar EPIs ao estoque
UPDATE public.estoque_epi SET quantidade_atual = quantidade_atual + 1 WHERE id = '9bac55b5-4c8c-44ee-ad30-82ab6c3f8e1e';
UPDATE public.estoque_epi SET quantidade_atual = quantidade_atual + 1 WHERE id = '8662d254-33f4-4444-891e-ac3a61ee4f2f';
UPDATE public.estoque_epi SET quantidade_atual = quantidade_atual + 1 WHERE id = 'fa5ca0df-9e7c-4ee7-961d-5914b289cc7c';
UPDATE public.estoque_epi SET quantidade_atual = quantidade_atual + 2 WHERE id = '86939bb1-c9c8-459d-b794-86db36f14fa5';

-- 2) Remover registros de movimentação
DELETE FROM public.historico_entregas WHERE id IN (
  '4bef7173-b39c-457a-94e2-e874a98447fa',
  '5bb79e64-6e9f-4eb0-a089-f79c5f554a64',
  '2f6ac33d-44bb-421a-9d62-a36162e232a8',
  'caaa5f2a-bb7b-4e71-9ffe-acce5ac479e5'
);
DELETE FROM public.epi_deliveries WHERE employee_id = 'c7a728ca-7334-4c42-9675-81a1eebd3366';

-- 3) Restaurar Bruno no registro e7e9b8e8 (limpando dados que vazaram do Raimundo)
UPDATE public.employees SET
  nome = 'Bruno Mergulhão da Silva',
  cpf = '095.863.242-14',
  company_id = '800de09b-dc70-4b33-b93b-8e805367737c',
  role_id = '86420ef4-23ac-49ef-a180-c6bb2bd38405',
  status = 'ATIVO',
  tipo_cadastro = 'NAO_MEI',
  admissao = NULL, bairro = NULL, cep = NULL, cidade = NULL, cnh = NULL, cnpj = NULL,
  data_aso = NULL, data_integracao = NULL, email = NULL, endereco = NULL, foto_url = NULL,
  matricula = NULL, nome_contato = NULL, nrs = '{}'::jsonb, rg = NULL, rg_orgao = NULL,
  setor = NULL, titulo = NULL, uf = NULL, whatsapp = NULL, whatsapp_emergencia = NULL,
  updated_at = now()
WHERE id = 'e7e9b8e8-701e-4666-a012-709da3a07fb0';

-- 4) Sumir com o Raimundo Soares Almeida em definitivo
DELETE FROM public.employees WHERE id = 'c7a728ca-7334-4c42-9675-81a1eebd3366';
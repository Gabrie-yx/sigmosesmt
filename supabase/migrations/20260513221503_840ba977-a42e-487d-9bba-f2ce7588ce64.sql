
-- 1) Add columns
ALTER TABLE public.producao_tipos_produto
  ADD COLUMN IF NOT EXISTS mtart text,
  ADD COLUMN IF NOT EXISTS tipo_embarcacao text,
  ADD COLUMN IF NOT EXISTS classe_avaliacao text;

-- Unique on nome to allow upsert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producao_tipos_produto_nome_key') THEN
    ALTER TABLE public.producao_tipos_produto ADD CONSTRAINT producao_tipos_produto_nome_key UNIQUE (nome);
  END IF;
END $$;

-- 2) Grupos de Mercadoria (SAP cliente)
INSERT INTO public.producao_grupo_mercadorias (codigo, descricao, ativo) VALUES
  ('AT0004','Matéria-Prima', true),
  ('AT0005','Produto Semi-acabado', true),
  ('AT0022','Terminal', true),
  ('AT0023','Empurrador', true),
  ('AT0024','Balsa', true),
  ('AT0025','Tanque', true),
  ('AT0033','Barco a Motor', true),
  ('AT0035','Estrutura metálica', true),
  ('AT0036','Estrutura flutuante', true)
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao, ativo = true;

-- 3) Classes de Avaliação
INSERT INTO public.producao_classes_avaliacao (codigo, descricao, ativo) VALUES
  ('7900','Semi-acabados em produção', true),
  ('7903','Semi-acabados - outros', true),
  ('7921','Produtos acabados', true)
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao, ativo = true;

-- 4) Limpa combinações antigas (4 tipos genéricos) e insere 8 combinações
DELETE FROM public.producao_tipos_produto
 WHERE nome IN ('EMPURRADOR','BALSA','ESTRUTURA FLUTUANTE','EMBARCAÇÃO','EMBARCACAO');

INSERT INTO public.producao_tipos_produto (nome, mtart, tipo_embarcacao, ncm, grupo_mercadorias, classe_avaliacao, ativo) VALUES
  ('EMPURRADOR (Casco em construção)', 'HALB', 'EMPURRADOR',          '89040000', 'AT0005', '7900', true),
  ('BALSA (Casco em construção)',      'HALB', 'BALSA',               '89079000', 'AT0005', '7900', true),
  ('ESTRUTURA FLUTUANTE (Casco em construção)', 'HALB', 'ESTRUTURA FLUTUANTE', '89079000', 'AT0005', '7900', true),
  ('EMBARCAÇÃO (Casco em construção)', 'HALB', 'EMBARCACAO',          '89011000', 'AT0005', '7900', true),
  ('EMPURRADOR (Acabado)',             'FERT', 'EMPURRADOR',          '89040000', 'AT0023', '7921', true),
  ('BALSA (Acabado)',                  'FERT', 'BALSA',               '89079000', 'AT0024', '7921', true),
  ('ESTRUTURA FLUTUANTE (Acabado)',    'FERT', 'ESTRUTURA FLUTUANTE', '89079000', 'AT0036', '7921', true),
  ('EMBARCAÇÃO (Acabado)',             'FERT', 'EMBARCACAO',          '89011000', 'AT0033', '7921', true)
ON CONFLICT (nome) DO UPDATE SET
  mtart = EXCLUDED.mtart,
  tipo_embarcacao = EXCLUDED.tipo_embarcacao,
  ncm = EXCLUDED.ncm,
  grupo_mercadorias = EXCLUDED.grupo_mercadorias,
  classe_avaliacao = EXCLUDED.classe_avaliacao,
  ativo = true;


INSERT INTO producao_grupo_mercadorias (codigo, descricao, ativo)
VALUES ('AT0005', 'Estruturas flutuantes / Embarcações', true)
ON CONFLICT (codigo) DO NOTHING;

UPDATE producao_tipos_produto SET ncm = '89040000', grupo_mercadorias = 'AT0005' WHERE nome = 'EMPURRADOR';
UPDATE producao_tipos_produto SET ncm = '89079000', grupo_mercadorias = 'AT0005' WHERE nome = 'BALSA';
UPDATE producao_tipos_produto SET ncm = '89079000', grupo_mercadorias = 'AT0005' WHERE nome = 'ESTRUTURA FLUTUANTE';
UPDATE producao_tipos_produto SET ncm = '89019000', grupo_mercadorias = 'AT0005' WHERE nome = 'EMBARCAÇÃO';

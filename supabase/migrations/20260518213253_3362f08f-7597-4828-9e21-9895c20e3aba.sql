-- Apaga itens da lista técnica órfã do casco legado 130
DELETE FROM producao_lista_tecnica_itens
WHERE lista_id = '0fa29d32-ece5-46ed-98fa-8f79e873adc8';

-- Apaga a lista técnica órfã
DELETE FROM producao_lista_tecnica
WHERE id = '0fa29d32-ece5-46ed-98fa-8f79e873adc8';

-- Apaga o casco duplicado legado (numero = '130')
DELETE FROM cascos
WHERE id = 'e8976cbf-900e-4aa8-a20f-a6766e3f89c5';
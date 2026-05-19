DELETE FROM producao_lista_tecnica_itens WHERE lista_id IN (SELECT id FROM producao_lista_tecnica WHERE casco_id = '868b9691-ea97-4c8f-b506-806fc1de0c26');
DELETE FROM producao_lista_tecnica WHERE casco_id = '868b9691-ea97-4c8f-b506-806fc1de0c26';
DELETE FROM cascos WHERE id = '868b9691-ea97-4c8f-b506-806fc1de0c26';
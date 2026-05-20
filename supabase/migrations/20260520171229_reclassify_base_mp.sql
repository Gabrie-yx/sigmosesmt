-- Reclassifica itens marcados como OUTROS na Base MP usando heurística por descrição.
-- Não toca em itens já corretamente classificados (FERRO/SOLDA/GÁS/TINTA).
UPDATE public.producao_base_materia_prima SET tipo = 'GÁS'
 WHERE tipo = 'OUTROS' AND descricao ~* '\m(gas|oxig|acetilen|argo[nm]|nitrog|co2|mistura|cilindro)\M';

UPDATE public.producao_base_materia_prima SET tipo = 'SOLDA'
 WHERE tipo = 'OUTROS' AND descricao ~* '\m(eletrod|arame.*(weld|tubular|mig|solda)|denver|fluxo.*sold|vareta|tig|mig|weld|7018|6013|e71t|er70|er-?70)\M';

UPDATE public.producao_base_materia_prima SET tipo = 'TINTA'
 WHERE tipo = 'OUTROS' AND descricao ~* '\m(tinta|primer|esmalte|epox|thinner|diluen|solvent|verniz|fundo)\M';

UPDATE public.producao_base_materia_prima SET tipo = 'FERRO'
 WHERE tipo = 'OUTROS' AND descricao ~* '\m(chapa|cantone|perfil|barra|vergalh|tubo|tarugo|trefilad|aco|a36|laminad|redondo|quadrado|sextavad)\M';

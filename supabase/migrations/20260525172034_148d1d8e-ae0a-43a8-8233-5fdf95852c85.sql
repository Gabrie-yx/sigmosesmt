-- Corrige semântica do campo "passo_a_passo" nos modelos de APR
-- O campo deve descrever a ETAPA da atividade, não controles/ações preventivas.
-- Esta migração reescreve passo_a_passo por índice em cada modelo afetado,
-- e atualiza a APR 000070526 com os passos corretos por linha.

-- Helper: função local para reescrever passo_a_passo posicional num jsonb array
CREATE OR REPLACE FUNCTION public._apr_set_passos(p_riscos jsonb, p_passos text[])
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_i int := 0;
  v_el jsonb;
BEGIN
  FOR v_el IN SELECT value FROM jsonb_array_elements(p_riscos) LOOP
    IF v_i < array_length(p_passos, 1) AND p_passos[v_i + 1] IS NOT NULL THEN
      v_el := jsonb_set(v_el, '{passo_a_passo}', to_jsonb(p_passos[v_i + 1]), true);
    ELSE
      v_el := v_el - 'passo_a_passo';
    END IF;
    v_out := v_out || v_el;
    v_i := v_i + 1;
  END LOOP;
  RETURN v_out;
END;
$$;

-- Içamento de longarina com pau-de-carga
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Içamento e elevação da carga',
  'Posicionamento de pessoas sob a projeção da carga',
  'Recebimento e ancoragem da peça em altura',
  'Operação do equipamento de içamento',
  'Sinalização e comunicação operador-sinaleiro'
]) WHERE id = 'e88c9479-b961-4f23-954c-1efb7d0c9a4d';

-- Içamento de contrapesos de concreto
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Engate e elevação do contrapeso',
  'Recebimento do contrapeso em altura',
  'Inspeção do olhal/ponto de içamento da peça',
  'Posicionamento e fixação manual do contrapeso',
  'Trabalho prolongado no topo do casco'
]) WHERE id = 'b72789b9-3bcf-44f3-91d7-d9d495e7332f';

-- Corte e esmerilhamento de peças no pátio
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Corte/esmerilhamento da peça em bancada',
  'Geração de fagulhas próximo a materiais combustíveis',
  'Operação contínua da esmerilhadeira (ruído)',
  'Geração de fumos e poeira durante o corte',
  'Conexão e uso de equipamento elétrico no pátio',
  'Permanência prolongada exposto ao sol'
]) WHERE id = 'aca2e86a-3ddf-4ce3-a416-97d542eb4377';

-- Corte e solda no costado com oxicorte
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Transporte e abertura dos cilindros de O₂/GLP/acetileno',
  'Execução do corte com chama oxicombustível',
  'Geração de fumos e gases durante o corte',
  'Trabalho a quente próximo a materiais combustíveis',
  'Acendimento e regulagem do maçarico'
]) WHERE id = 'd64a731f-af06-4ed5-a2c7-8c504e353e8d';

-- Jateamento em altura no costado
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Trabalho em altura sobre o costado',
  'Manuseio da mangueira de jato pressurizado',
  'Aplicação do jato abrasivo na superfície',
  'Operação prolongada exposto a ruído alto',
  'Trabalho com circulação de pessoas abaixo',
  'Manuseio contínuo da mangueira (vibração mão-braço)'
]) WHERE id = '73dd6936-c5ab-441d-a7f5-a4229379f775';

-- Solda em altura dentro do casco
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Acesso e trabalho de solda em altura',
  'Manuseio de ferramentas e eletrodos em altura',
  'Execução da soldagem',
  'Soldagem em ambiente fechado dentro do casco',
  'Operação do equipamento de solda',
  'Geração de respingos próximo a materiais combustíveis'
]) WHERE id = '0e78970c-b643-4bba-bfbc-3e29d6a88906';

-- Solda overhead em andaime
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Soldagem em posição overhead (sobrecabeça)',
  'Trabalho sobre andaime em altura',
  'Geração de fumos concentrados na posição overhead',
  'Soldagem com cabeça inclinada para cima por tempo prolongado',
  'Queda de respingos sobre materiais abaixo do andaime'
]) WHERE id = 'b1db99bd-c523-419a-b7ec-634b11e144bc';

-- Trabalho a quente em cesto aéreo
UPDATE public.apr_modelos SET riscos = public._apr_set_passos(riscos, ARRAY[
  'Subida e operação do cesto aéreo',
  'Trabalho do operador dentro do cesto',
  'Execução de solda dentro do cesto',
  'Trabalho a quente em espaço restrito do cesto',
  'Manobra/deslocamento do cesto durante o serviço'
]) WHERE id = '8438f976-e948-451c-a32a-3fb932aebeff';

-- Corrige a APR 000070526 (Içamento de longarina)
UPDATE public.apr_riscos r
   SET passo_a_passo = CASE r.ordem
     WHEN 1 THEN 'Içamento e elevação da carga'
     WHEN 2 THEN 'Posicionamento de pessoas sob a projeção da carga'
     WHEN 3 THEN 'Recebimento e ancoragem da peça em altura'
     WHEN 4 THEN 'Operação do equipamento de içamento'
     WHEN 5 THEN 'Sinalização e comunicação operador-sinaleiro'
     ELSE r.passo_a_passo
   END
  FROM public.aprs a
 WHERE r.apr_id = a.id
   AND a.numero = '000070526';

-- Limpa a função auxiliar
DROP FUNCTION public._apr_set_passos(jsonb, text[]);
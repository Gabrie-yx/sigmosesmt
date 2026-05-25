UPDATE public.aprs
SET texto_gerais = $TXT$01 - Em caso de ILUMINAÇÃO DEFICIENTE nos locais das atividades, fazer uso de refletores ou lanternas para atividades pontuais.
02 - Em caso de EMERGÊNCIA operacionalizar as ações do PAE - Plano de atendimento a Emergência.
03 - Antes do início da atividade com uso de SOLDA, OXI-GÁS OU LIXADEIRA (serviço a quente), verificar se existe a presença de INFLAMÁVEIS (óleo ou graxa, tinta, solvente etc) nas proximidades, não iniciar o serviço e retirar o material inflamável.
04 - NÃO manusear o manômetro do cilindro de oxigênio com as mãos ou luvas sujas de óleo e graxa, "risco de explosão".
05 - Fazer a DESTINAÇÃO DOS RESÍDUOS gerados nas atividades corretamente ou mantê-los segregados e isolados adequadamente. NUNCA jogar no rio ou lixeiras comuns.
06 - Qualquer DEFEITO que apresente máquinas ou acessórios deve ser informado IMEDIATAMENTE ao responsável pelo serviço.
07 - Manter EXTINTOR no local, nas atividades à quente.
08 - DIVULGAR os Procedimentos executivos relacionados à atividade.
09 - PROIBIDO EXECUTAR qualquer atividade que não esteja prevista nesta APR.
10 - Em caso de ACIDENTE ou INCIDENTE comunicar imediatamente ao SESMT, Encarregado, Supervisor.

Com a intenção de preservar a sua segurança, bem como a dos demais trabalhadores do DMN ESTALEIRO, os seguintes comportamentos serão considerados inaceitáveis, ou seja, está colocando a sua vida em risco e serão penalizados com medidas disciplinares:
• Execução de tarefa crítica sem permissão e/ou sem seguir o procedimento (altura, a quente, içamento de cargas, espaço confinado, elétrica);
• Retirada da proteção de partes móveis de máquinas e equipamentos;
• Não usar corretamente os Equipamentos de Proteção Individuais;
• Operar máquinas pesadas sem autorização.$TXT$
WHERE numero IN ('000010526','000020526','000030526','000040526','000050526')
  AND (texto_gerais IS NULL OR texto_gerais = '');
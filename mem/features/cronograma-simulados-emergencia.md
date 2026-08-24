---
name: Cronograma de Simulados de Emergência (pesquisa + plano SIGMO)
description: Base normativa dos simulados (NBR 15219 4.6.1 anual, NR-20 20.15.5 anual, NR-33 simulado anual + resgatista bienal, NR-35 treino bienal) e desenho do módulo automatizado no SIGMO (FOR-SEG-12 cronograma / FOR-SEG-15 relatório).
type: feature
---
## Periodicidade normativa (pesquisada 24/08/2026)
| Norma | Item | Exigência | Prazo |
|---|---|---|---|
| ABNT NBR 15219 | 4.6.1 | 1 simulado COMPLETO (ou parciais cobrindo toda a planta) | 12 meses |
| NR-20 | 20.15.5 | Simulado do Plano de Resposta a Emergências, em horário de trabalho | mín. anual (reduzir se houver falha/AR) |
| NR-20 | 20.15.2(e) | Cronograma + metodologia + registros são documento obrigatório | — |
| NR-33 | 33.5.9.2 | Simulado anual de salvamento em espaço confinado | anual |
| NR-33 Anexo III | Quadro 1 | Vigia/trabalhador autorizado 8h; resgatista reciclagem | anual / bienal |
| NR-33 | 33.5.20.2(e) | Plano de resgate deve prever simulados dos cenários | — |
| NR-35 | 35.4.2.2 | Treinamento periódico de altura | bienal |
| NR-35 | 35.7.1 | Procedimento de resposta + tempo de suspensão inerte | sem prazo fixo (definido por AR) |
| NR-34 | — | Remete a NR-33/NR-35 (naval) | conforme NR-33/35 |
| NR-23 | 23.3.2 | Informar procedimentos de resposta/evacuação | via IT bombeiros/NBR |
| ISO 45001 | 8.2 | Testar periodicamente a capacidade de resposta | "periodicamente" |
Notas: NR-05 não exige simulado (CIPA/SIPAT = canal de divulgação). NBR 15219 4.7 exige ata de reunião pós-simulado com brigada, SESMT e CIPA. Tempos-alvo (abandono, acionamento, resgate) NÃO são normativos — são metas da empresa via AR. ITs de bombeiro variam por UF (AM para a DMN).

## Plano de módulo no SIGMO (não implementado)
Templates já cadastrados sem motor: FOR-SEG-12 (Cronograma de Simulados) e FOR-SEG-15 (Relatório de Simulado).
Tabelas propostas: `simulado_cenarios` (catálogo cenário↔norma↔periodicidade meses), `simulado_cronograma` (ano, empresa, cenário, mês previsto, escopo PARCIAL/COMPLETO, com/sem aviso, status), `simulados` (execução: data, hora do alarme, tempos cronometrados, participantes, avaliação, nota), `simulado_participantes`, `simulado_evidencias`.
Automação: gerar cronograma anual a partir dos riscos do PGR/cargo_riscos (altura→NR-35, confinado→NR-33, inflamável→NR-20, incêndio→NBR 15219); alerta na Agenda SESMT/Hoje 30 dias antes; travar ano se faltar o COMPLETO; NC automática em plano_acoes quando simulado atrasa ou reprova (mesmo padrão da NC de inspeção); tempos alimentam indicadores.

---
name: PCMSO DMN REV.05 (10/03/2026)
description: Estrutura do PCMSO DMN Estaleiro — base para módulo ASO automático e seed
type: feature
---
# PCMSO DMN Estaleiro — REV.05

**Empresa:** DMN Estaleiro Amazônia (CNPJ 13.378.697/0001-80)
**Médico:** Dr. Francisco Marcelino Malheiros — CRM/AM 331
**Clínica:** Integral Ocupacional (CNPJ 02.145.060/0001-28)
**Base:** NR-07 + Portaria MTP 567/2022 + eSocial Tabela 27

## Estrutura por GHE (mesmos do PGR)
GHE 01, 02, 07 = Administrativo · GHE 03, 04, 05, 08, 09, 10 = Produção · GHE 06 = Almoxarifado

## Para cada Cargo: Riscos + Exames por tipo de ASO
6 tipos de ASO (eSocial): Admissional, Periódico, Retorno ao Trabalho, Mudança de Risco, Demissional, Semestral.

## Códigos eSocial Tabela 27 mais usados
- 0283 Audiometria Tonal · 0295 Avaliação clínica · 0296 Acuidade visual
- 0300 Avaliação psicossocial · 0530 ECG · 0658 Glicemia
- 0673 ABO+Rh (Lei 4.488/2017 — admissional obrigatório) · 0693 Hemograma
- 1057 Espirometria · 1075 Rx coluna lombo-sacra · 1204 TGO · 1205 TGP

## Novidades REV.05
- Risco Psicossocial (assédio/estresse) em quase todos GHEs
- Químico Álcool em Gel adicionado
- 0673 ABO+Rh obrigatório no admissional (Lei 4.488/2017)
- Excluído: Encarregado(a) de Manutenção Mecânica

## Pendências / Ambiguidades
- Periodicidade de cada exame periódico não consolidada em tabela

## Respostas do usuário (02/06/2026)
- **GHE 11/12/13**: mantém o que está no PGR atual (DMN). REV.05 do PCMSO é a referência de exames, mas a lista de GHEs segue o PGR vigente.
- **Motorista profissional**: SIM, DMN tem. Modelar **Exame Toxicológico (S-2221)** como obrigatório para cargos de motorista (CNH C/D/E). Vincular ao evento eSocial S-2221.
- **Terceirizados**: ATENÇÃO — muitos cargos sensíveis (motorista, soldador, etc.) são **terceirizados** gerenciados pelo SIGMO. O módulo de ASO/PCMSO precisa funcionar tanto para CLT próprios quanto para terceirizados (provavelmente via `employees.tipo_vinculo` ou tabela `terceiros`). Verificar no schema antes de implementar.

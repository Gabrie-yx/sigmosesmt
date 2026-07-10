---
name: PAUSADO · Bloqueios de funcionários com OS assinada na PET
description: Investigação dos 44 funcionários com OS assinada aparecendo bloqueados no dropdown da PET. Diagnóstico feito, correções pendentes.
type: feature
---

## Como retomar
Usuário chama de: **"bloqueios OS x PET"** ou **"os 44 da PET"**.

## Diagnóstico confirmado (não é bug de OS)
- 44 OSs `ASSINADO` válidas em `oss_emissoes` (expira futuro, pdf preenchido).
- `useQuery` em `app.ptes.tsx` linha 176 baixa o Set corretamente.
- Regra `safety-engine.ts` linha 162: `if (ossValid === false)` só bloqueia quem NÃO está no Set. OK.
- Os 42 bloqueados estão travados por **outras pendências documentais** (principalmente ASO — `employees.data_aso` null + poucos registros em `employee_exams`).

## Pendências para retomar
1. Decidir: migração espelhando `data_aso` legado → `employee_exams`, OU RH sobe PDFs novos pelo módulo Medicina Ocupacional.
2. Corrigir cadastro do cargo **Eletricista Pleno** (e Básico/Sênior) — hoje `req_nrs: []`, deveria exigir NR-10, NR-06, NR-35.
3. Melhorar tooltip do dropdown da PET: hoje mostra só 🚫, passar a listar o motivo real ("Falta ASO, NR-18").
4. Relatório dos 44 com OS assinada + pendências por funcionário já foi gerado em `/mnt/documents/regularizacao-oss-pet-2026-07-10.xlsx` (pode precisar regenerar após correções).

## Casos concretos verificados
- **Natanael Marins de Lira** (000252, Eletricista Pleno): sem OS assinada, sem ASO, sem integração, sem NRs.
- **Natanel dos Santos Assis** (Auxiliar de Montagem): sem ASO.
- **Raimundo Souza** (Soldador): sem ASO, integração e NRs.

## Contexto humano
- Aline Farias NÃO trabalha mais na empresa — nunca citar. TST atual: Francisco Bandeira Almeida.
- Usuário vai testar overrides manuais em ~3 funcionários pra validar fluxo de OS.
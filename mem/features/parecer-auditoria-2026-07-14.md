---
name: Parecer Auditoria SIGMO 2026-07-14 (fonte oficial)
description: PT-AUD-SIGMO-2026-07 — 117 achados (32 CRÍTICOS · 47 GRAVES · 38 MODERADOS) organizados em 6 ondas. Fonte da verdade pra qualquer conversa sobre "onda X do parecer".
type: reference
---

## Doc
PDF em user-uploads://PARECER-AUDITORIA-SIGMO-2026-07-14.pdf (data emissão 14/07/2026, escopo: PGR/PCMSO/EPI/Treinamentos/Acidentes + OS/PTE/APR/NR-33/35/10 + RH/Portaria/Desligamento/PPP/Contratadas/Ponto + RBAC/SSR/LGPD).

## Matriz de ondas (Bloco 4)
| Onda | Escopo | Achados | Status |
|---|---|---|---|
| 1 — Vetores externos | Fechar exposição pública | C-31 a C-34 | ✅ concluída |
| 2 — Fluxos cross-module críticos | Desligamento/cargo/GHE/acidente/portaria | C-01 a C-10 + G-01 a G-08 | 🟡 parcial (só C-02, C-04 e cronjob ASO extra) |
| 3 — Travas PT / NR-33/35/10 | PET+medição, resgate, treinos cruzados, override auditado | C-11 a C-16 + G-16 a G-28 | ⏳ pendente |
| 4 — Documentação legal | EPI/ASO/PPP/OS + ponto CLT | C-17 a C-30 + G-29 a G-42 | ⏳ pendente |
| 5 — RBAC + LGPD refinado | beforeLoad server-side, logRead, revogação consent | G-43 a G-47 + M-23/27/29/30 | ⏳ pendente |
| 6 — Backlog moderadas | Refinamentos operacionais | M-01 a M-38 | ⏳ contínuo |

## Top-10 riscos (sumário executivo)
1. Desligamento não bloqueia portaria nem cancela APR/PTE (NR-33 33.4.1 · LGPD 16)
2. PTE de confinado sem medição atmosférica e sem plano de resgate (NR-33 33.3.3/33.3.2h) — óbito IPVS
3. Vencimento NR-33/34/35/10 não bloqueia PTE nem portaria
4. Mudança de cargo não invalida OS, não gera ASO mudança, não revisa PPP
5. CA vencido + falta assinatura EPI + treino não verificado (NR-06)
6. Fotos em bucket público com URL permanente (LGPD) — ✅ fechado Onda 1
7. `/api/pgr-chat` e `/api/sigmo-chat` sem auth — ✅ fechado Onda 1
8. Prazo CAT (1 dia útil) não alertado (Lei 8.213 art.22)
9. Exclusão física em oss_emissoes, nao_conformidades, pte_medicoes_atmosfericas, employee_exams
10. eSocial S-2299 (rescisão) e S-2500 (PPP eletrônico) não gerados

## Onda 2 detalhada (Bloco 2 do parecer)
### Críticos
- **C-01** Desligamento não bloqueia entrada Portaria — falta `UPDATE portaria_pessoas SET bloqueado=true` na RPC `finalizar_desligamento_pacote` (NR-01 1.4.1b, NR-34 34.9, LGPD 16)
- **C-02** ✅ Desligamento cancela APRs/PTEs (feito Onda 2 Item 1 via trigger `trg_fechar_pendencias_ao_desligar`)
- **C-03** Mudança cargo não invalida OS existente — trigger PG: `UPDATE oss_emissoes SET status='EXPIRADA' WHERE cargo_snapshot <> novo_cargo` (NR-01 1.4.1c)
- **C-04** ✅ Mudança cargo gera ASO MUDANCA_FUNCAO — feito Onda 2 Item 3 (trigger `trg_employee_role_change` + histórico + audit). ⚠️ FALTA convocar exame `MUDANCA_FUNCAO` com data_limite = data_efetiva - 1 dia
- **C-05** Vencimento NR-33/34/35/10 não bloqueia PTE nem portaria — cruzar `employees.nrs`/`employee_trainings` do executante/vigia/supervisor no mutationFn PTE e wizard portaria
- **C-06** Novo risco no GHE não dispara convocação extraordinária ASO — trigger `AFTER INSERT/UPDATE ON pgr_inventario_riscos` inserindo convocações tipo EXTRAORDINARIO pra membros efetivos do GHE (NR-07 7.5.1.3.2)
- **C-07** CAT sem prazo automático 1 dia útil — calcular `prazo_cat = nextBusinessDay(data_acidente)` + pendência vermelha (Lei 8.213 art.22)
- **C-08** CAT com afastamento não gera ASO RETORNO_TRABALHO — `onSuccess` do save acidente COM_AFASTAMENTO chama `resolverExamesFuncionario(id, 'RETORNO_TRABALHO', data_retorno)` (NR-07 7.5.1.III, ≥30d)
- **C-09** Desligamento não emite PPP nem enfileira eSocial S-2299/S-2500 — criar tabela `esocial_eventos_pendentes` + emitir automático (Lei 8.213 §4º)
- **C-10** ASO demissional não é convocado automaticamente — no wizard desligamento chamar `resolverExamesFuncionario(id, 'DEMISSIONAL')` com data_limite = data_desligamento

### Graves G-01 a G-08
- G-01 Contratada com doc vencido não bloqueia portaria
- G-02 (ver parecer)
- G-03 (ver parecer)
- G-04 (ver parecer)
- G-05 (ver parecer)
- G-06 (ver parecer)
- G-07 (ver parecer)
- G-08 Desligamento não emite PPP automaticamente (só UI opcional)
- G-09 Portaria não verifica ASO/integração de PRESTADOR/FORNECEDOR
- G-10 Portaria não valida CNH categoria vs veículo
- G-11 Saída fora expediente sem alerta
- G-12 Dispensa ASO demissional declaratória (sem verificar 90/135d — NR-07 7.5.15.4)
- G-13 Checklist "PPP entregue" marcado só por existir emissão (sem recibo assinado)
- G-14 Motivos desligamento sem código eSocial S-2299
- G-15 Trabalhador em múltiplos GHEs não suportado (FK 1:1) — criar N:N `roles_ghe`

## Onda 3 detalhada
### Críticos (C-11 a C-16)
- C-11 PET NR-33 ativa sem medição atmosférica de ENTRADA
- C-12 Medição fora de limite só alerta — não bloqueia salvar
- C-13 PET sem campo obrigatório `plano_resgate`
- C-14 Numeração PTE por `Math.random()` — criar sequence `gerar_numero_pte`
- C-15 APR ativada sem assinatura EXECUTANTE
- C-16 Override GLOBAL só exige isAdmin — restringir a sesmt/moderador + 4-eyes + CRM + validade máx 30d

### Graves G-16 a G-28
- G-16 Vigia NR-33 sem verificar treino 40h vigia
- G-17 Supervisor entrada NR-33 sem curso 16h supervisor
- G-18 Delete físico OS
- G-19 `ossValidIds` não computado na listagem geral
- G-20 Duplicação APR copia `assinou_em` (deveria zerar)
- G-21 Reciclagem hardcoded 2 anos pra todas NRs — migrar pra tabela CH+tipo
- G-22 PTE "Emergência sem APR" liberada a qualquer editor
- G-23 Delete físico medição atmosférica
- G-24 `fetchAllActiveOverrides` sem filtro `expira_em > now()`
- G-25 CNPJ hardcoded 13.378.697/0001-80 na APR
- G-26 Override ITEM "ASO" não distingue ASO altura/confinado
- G-27 APR com `exige_pte=true` pode ficar ATIVA sem PTE
- G-28 APR aceita só PNG (OS aceita PNG/JPEG/WebP)

## Ondas 4-6
Ver PDF páginas 6-15. Detalhar sob demanda quando chegarmos.

## Falsos positivos possíveis (Bloco 5 obs 4)
Achados que dependem de RPCs/triggers Supabase não legíveis pelo frontend — validar cada CRÍTICO com inspeção direta no schema antes de codar.
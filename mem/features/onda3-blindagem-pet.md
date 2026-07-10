---
name: Onda 3 · Pacote C-11/C-12/C-13 (PET NR-33 blindada)
description: Migração 20260710-122131 + front app.ptes/PteAtmosferaTab. Modo strict opt-in, plano_resgate estruturado, soft delete de medições. Fase 1 da Onda 3 do parecer.
type: feature
---

## Status
✅ Migração aplicada e front implementado. Pendente teste manual do Francisco.

## O que virou lei no banco
- `company_settings.pet_modo_strict boolean DEFAULT false` — chave da blindagem por empresa
- `ptes.plano_resgate jsonb` — sub-chaves: equipe_resgate, equipamentos, hospital_referencia, tempo_resposta_min, meio_comunicacao
- `pte_medicoes_atmosfericas.deleted_at/deleted_by/deleted_motivo` — soft delete (DELETE físico bloqueado por trigger)
- Trigger `trg_validar_pet_strict` — em modo strict, bloqueia PET ATIVA sem plano completo ou sem medição ENTRADA conforme
- Trigger `trg_medicao_reage_pet` — em modo strict, medição fora do limite força PET → SUSPENSA + audit log `pet_suspensa_atmosfera`
- Trigger `trg_bloquear_delete_medicao` — DELETE físico proibido, always-on
- Function `pet_status_alerta(uuid)` — helper JSON com `needs_medicao_entrada`, `atmosfera_alerta`, `needs_plano_resgate` (autoriza `authenticated`)
- Function `medicao_soft_delete(uuid, text)` — exige motivo ≥10 chars, autentica user, grava audit

## Front
- `src/routes/app.ptes.tsx`:
  - emptyForm ganhou plano_equipe_resgate/equipamentos/hospital_referencia/tempo_resposta_min/meio_comunicacao
  - startEdit hidrata do jsonb `plano_resgate`
  - save serializa em jsonb estruturado (só se tipo_pt === 'PET')
  - Card "Plano de Resgate (NR-33 33.3.2.h)" renderiza só pra PET, com selo "Modo Strict" quando ativo
  - Alerta amarelo "Modo Relax ativo" quando strict=false
  - Query `medsAll` (todas medições ativas) + `petAlertas` computa 3 estados por PET em memória
  - Badges no histórico: ATMOSFERA FORA DO LIMITE (vermelho), MEDIÇÃO PENDENTE (âmbar), SEM PLANO DE RESGATE (laranja)
- `src/components/ptes/PteAtmosferaTab.tsx`:
  - Query filtra `deleted_at IS NULL`
  - Botão delete vira prompt de motivo → RPC `medicao_soft_delete`

## Pendente de teste pelo Francisco
1. Ligar `pet_modo_strict=true` em `company_settings` e tentar emitir PET sem plano → deve bloquear com mensagem NR-33 33.3.2.h
2. Em modo strict, registrar medição ENTRADA fora do limite → PET deve virar SUSPENSA automaticamente, ver `audit_logs action='pet_suspensa_atmosfera'`
3. Tentar deletar medição via SQL: `DELETE FROM pte_medicoes_atmosfericas WHERE id=...` → deve dar erro "DELETE físico proibido"
4. Soft delete via botão do painel → prompt de motivo, ver `deleted_at`, `deleted_by`, `deleted_motivo` preenchidos
5. Emitir PET em modo relax sem plano/medição → deve emitir com badges vermelho/amarelo/laranja no histórico

## Próximo da Onda 3
C-15 (APR sem assinatura executante) + G-18/G-23 (soft delete OSS + medições — parte já feita) + C-16 (override GLOBAL 4-eyes) + C-14 (sequence PTE).

## Config UI pendente
Toggle do `pet_modo_strict` ainda não tem UI. Hoje precisa alterar via SQL. Adicionar em `/app/sesmt/catalogos/index.tsx` ou criar tela de "Configurações SESMT" quando o Francisco pedir.
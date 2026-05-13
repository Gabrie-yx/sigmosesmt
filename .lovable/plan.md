
## Objetivo

Tornar a APR o documento "guarda-chuva" e a PTE a autorização operacional vinculada a ela — fechando o ciclo de segurança e permitindo medir cobertura.

---

## 1. Banco de dados (migração)

- Adicionar coluna `apr_id UUID NULL` em `ptes` (referência lógica à APR de origem; nullable porque PTEs antigas/avulsas continuam válidas).
- Índice em `ptes(apr_id)` para joins do painel.
- Sem RLS nova — herda as policies já existentes de `ptes`.

> Não vou criar FK física pois a APR pode ser excluída e a PTE histórica deve persistir (igual a outras relações do projeto).

---

## 2. Auto-detecção de "exige PTE" na APR

Lista de gatilhos (qualquer um marca `exige_pte = true` automaticamente quando o usuário adiciona/edita risco):

| Gatilho | Origem |
|---|---|
| NR-35 (Altura > 2 m) | `apr_riscos.nrs` contém "NR-35" ou nome do risco contém "altura" |
| NR-33 (Espaço Confinado) | "NR-33" ou nome contém "confinad" |
| NR-34 (Trabalho a Quente: solda/corte/esmerilhamento) | "NR-34" ou nome contém "quente"/"solda"/"corte"/"esmeril" |
| NR-10 (Eletricidade energizada/AT) | "NR-10" ou nome contém "el\u00e9tric"/"energiz" |
| Içamento / carga suspensa | nome contém "i\u00e7amento"/"carga suspensa"/"guindaste"/"p\u00f3rtico" |
| Pintura em ambiente fechado | nome contém "pintura" + algum indicador de "fechado/confinado" |

Comportamento na UI (`apr-form.tsx`):
- Toggle `exige_pte` continua editável, mas vira **read-only TRUE** quando a auto-detecção dispara, com badge "Detectado automaticamente — riscos críticos presentes".
- Lista os motivos abaixo do toggle.

---

## 3. Botão "Gerar PTE da APR"

No menu de ações da APR (lista `app.aprs.tsx` + dentro do form ao salvar APR ATIVA com `exige_pte`):

- Item: **"Gerar PTE vinculada"** (visível só para editor e quando `exige_pte = true`).
- Ao clicar, navega para `/app/ptes` abrindo o formulário de PTE em modo "novo", pré-preenchendo via state:
  - `apr_id` = APR de origem
  - `casco_id`, `empresa_id`, `local`, `data` 
  - `risco` = principal categoria detectada (NR-35/33/34/10/Içamento/Pintura)
  - `dados.nrs` = união dos `nrs` da APR
  - `dados.executantes` = assinaturas de papel "EXECUTANTE" da APR
  - `dados.atividade` = `atividade_descricao`
- Após salvar a PTE, o sistema:
  - Mostra toast "PTE 0001/25 vinculada à APR 00012525"
  - Volta para lista de APRs com a APR origem destacada.

Na lista de PTEs, nova coluna **"APR origem"** com link clicável; filtro por "Tem APR / Órfã".

Na lista de APRs, nova coluna **"PTEs"** mostrando contagem (`2 emitidas`) com tooltip listando números — clique abre o filtro de PTEs daquela APR.

---

## 4. Indicadores no Painel (`app.painel.tsx`)

Bloco novo **"Cobertura APR ↔ PTE"** com 4 cards:

1. **Cobertura de APRs críticas** — `% de APRs com exige_pte=true que possuem ≥1 PTE emitida` (período: últimos 30 dias). Cor: verde ≥95%, amarelo 80–95%, vermelho <80%.
2. **PTEs órfãs** — contagem de PTEs sem `apr_id` no período. Drill-down: lista.
3. **APRs vencidas com PTE ativa** — `aprs.data_validade < hoje` AND existe PTE `status='ATIVA'` vinculada. Risco operacional crítico.
4. **PTEs no mês por NR** — mini gráfico de barras (NR-35, NR-33, NR-34, NR-10, Içamento) usando `ptes.risco`.

---

## 5. PDF da APR

- No bloco GERAIS, ao final, adicionar linha condicional quando `exige_pte = true`:
  > "⚠ Esta atividade EXIGE Permissão de Trabalho Especial (PTE). Emitir PTE conforme procedimento interno antes do início das atividades. PTE(s) vinculada(s): 0001/25, 0002/25 — ou — NENHUMA EMITIDA (PENDENTE)."

---

## 6. Arquivos afetados

**Novos:**
- `supabase/migrations/<timestamp>_apr_pte_link.sql`
- `src/lib/apr-pte-rules.ts` — função `detectarExigenciaPTE(riscos)` reutilizada no form e no PDF.

**Editados:**
- `src/components/aprs/apr-form.tsx` — auto-detecção + UI.
- `src/routes/app.aprs.tsx` — coluna PTEs + ação "Gerar PTE".
- `src/routes/app.ptes.tsx` — coluna APR origem + filtro órfãs + suporte a `apr_id` prefill via location state.
- `src/lib/apr-pdf.ts` — bloco de aviso PTE no GERAIS.
- `src/routes/app.painel.tsx` — bloco novo de cards.

---

## Fora de escopo (deixar para depois se quiser)

- Bloquear ATIVAÇÃO da APR sem PTE (você escolheu o fluxo de botão, não bloqueio).
- Relação N:N (escolheu 1:N).
- Workflow de aprovação eletrônica da PTE pelo SESMT (já existe `created_by`).

---

Aprova? Se sim, eu já disparo a migração e implemento na sequência.

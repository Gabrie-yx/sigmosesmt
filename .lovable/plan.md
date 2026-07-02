## Fluxo final da RC

```
PENDENTE  →  EM_COTACAO  →  COTADA  →  APROVADA
   │            │             │      ↘  INDEFERIDA (com motivo)
   │            │             │
solicitante   compras       cotador
  emite       "pegou"       registra fornecedor+valor
                                        ↓
                              Supervisor Geral (Anderson) decide
                              com assinatura já salva na base
```

## 1) Migração no banco

**`purchase_requisitions`** — novas colunas:
- `pego_por_compras_id uuid`, `pego_por_compras_nome text`, `pego_em timestamptz` — rastreio de quem tirou da fila
- `decidido_por_id uuid`, `decidido_por_nome text`, `decidido_assinatura_url text`, `decidido_em timestamptz` — carimbo do Anderson no PDF
- Status agora aceita `EM_COTACAO` (texto livre, sem CHECK — segue padrão do projeto)

**`company_settings`** — nova coluna `supervisor_geral_user_id uuid` para eleger o Anderson como o único aprovador (fica configurável se um dia mudar). Se não estiver setado, cai no fallback: qualquer `admin` decide.

**Função `is_supervisor_geral(uid)`** — SECURITY DEFINER, retorna `true` se `uid = company_settings.supervisor_geral_user_id` OU se for `admin`.

**Trigger em `audit_logs`** para toda mudança de status da RC (rastreabilidade ISO 9001).

## 2) Backend — `src/lib/rc-public.functions.ts`

- **`pegarRcParaCotar(token)`** — nova server fn com `requireSupabaseAuth`, muda PENDENTE→EM_COTACAO, grava quem pegou. Bloqueia se outro comprador já pegou.
- **`marcarRcCotada`** — passa a aceitar tanto PENDENTE quanto EM_COTACAO (compat).
- **`decidirRc`** — troca o gate de `admin/moderador` por `is_supervisor_geral(uid)`. Ao aprovar, busca a assinatura do Anderson em `user_signatures` (a mais recente) e grava em `decidido_assinatura_url`. Indeferimento continua exigindo motivo.
- **`listarRcsPorStatus(status?)`** — para o badge do header/painel.

## 3) UI

- **`/rc/:token`** — badge de status ganha `EM_COTACAO` (roxo "Em cotação por Fulano"). Comprador logado vê botão **"Pegar para cotar"** quando PENDENTE. Só o supervisor vê Deferir/Indeferir.
- **`/app/sesmt/requisicoes`** — coluna "Cotador" mostra quem pegou; filtro por status inclui EM_COTACAO.
- **Badge no header** (`src/components/app-header.tsx`) — bolinha pulsante com contagem de RCs que precisam da atenção do usuário logado:
  - Comprador → PENDENTE (fila livre)
  - Supervisor → COTADA (aguardando decisão dele)
  - Clica → vai pra `/app/sesmt/requisicoes` com filtro pré-aplicado
- **PDF da RC** (`src/lib/requisicao-medicamentos-pdf.ts` e correlatos) — rodapé com **duas datas + duas assinaturas**: cotador (data cotação) e Supervisor Geral (data decisão, assinatura puxada de `decidido_assinatura_url`).

## 4) Configuração inicial

Após a migração, uma linha de UPDATE em `company_settings` setando `supervisor_geral_user_id` = user_id do Anderson (te peço o UUID ou eu busco por `full_name ILIKE 'anderson%'` no profile).

## Como fica visualmente

```text
Header:  [🔴 3]  ← badge pulsando pro Anderson (3 RCs cotadas esperando)
                  clica → painel filtrado em "COTADA"

RC status: PENDENTE  →  EM_COTACAO (Juce)  →  COTADA (R$ 1.240)  →  APROVADA ✓
                                                                     Anderson
                                                                     02/07/2026 09:14
```

Fora do escopo desta iteração: WhatsApp (deixamos os campos prontos, só não disparamos msg), sub-fluxo de "devolver ao requisitante" (compras só cota ou não pega).

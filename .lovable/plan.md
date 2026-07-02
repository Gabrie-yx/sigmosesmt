## Módulo Compras — Escopo aprovado

### Setores emissores de RC (dropdown ao criar)
Produção · Manutenção Elétrica · Manutenção Mecânica · Administrativo · Almoxarifado · SESMT

### Fluxo novo
```
[Setor X]  → cria RC (PENDENTE)
   │
   ▼
[Compras / RC Recebidas]  → "Pegar p/ cotar" (EM_COTACAO, trava p/ outros)
   │        → anexa 3 cotações (PDF/JPG) obrigatórias
   │        → registra fornecedor vencedor + valor
   ▼
COTADA  → libera pro Anderson (Supervisor Geral)
   │
   ▼
APROVADA / INDEFERIDA  (só Anderson decide, já implementado)
```

### 1. Banco (migration)
- `AppModule` ganha `"compras"` (via `user_module_access.module`).
- Novo role `compras` no enum `app_role` (pra você atribuir depois).
- Nova tabela `rc_cotacoes`:
  - `rc_id` (fk → purchase_requisitions)
  - `fornecedor`, `valor`, `arquivo_url`, `arquivo_nome`, `arquivo_tipo`
  - `is_vencedora` (bool)
  - `created_by`, `created_at`
  - RLS: leitura pra authenticated; insert/update/delete pra compras+admin+supervisor_geral
  - GRANT authenticated + service_role
- `purchase_requisitions.setor` já existe → só padronizamos os valores no dropdown.
- Trigger/validação no `marcarRcCotada`: exigir mínimo **3 anexos** antes de setar `COTADA`.
- Bucket privado `rc-cotacoes` (via tool).

### 2. Backend (server functions)
- `src/lib/rc-compras.functions.ts`:
  - `listarRcsRecebidas` (compras vê PENDENTE + EM_COTACAO próprias)
  - `anexarCotacao` (upload path + insert row)
  - `removerCotacao`
  - `marcarVencedora` (garante 1 só is_vencedora=true)
  - Refactor `marcarRcCotada` → só aceita se ≥3 cotações E 1 vencedora.

### 3. Frontend
- Nova rota `src/routes/app.compras.requisicoes-recebidas.tsx`
- Sidebar: novo grupo **Compras** com submenu "RC Recebidas" (`app-sidebar.tsx` + `menu-catalog.ts`)
- `RcHeaderBadge`: adiciona contagem "Recebidas" quando user tem módulo compras
- Componente `CotacoesUploader` (drop 3 arquivos, marca vencedora)
- Ao criar RC (SESMT hoje): trocar campo `setor` livre por Select com os 6 setores fixos

### 4. Permissões
- `hasModule('compras')` libera menu
- Só role `compras` (ou admin) pode:
  - "Pegar p/ cotar"
  - Anexar/remover cotação
  - Marcar vencedora
  - Enviar pro Supervisor
- Anderson (`supervisor_geral`) continua sendo o único que defere/indefere.

### 5. PDF da RC
- Rodapé ganha bloco listando as 3 cotações (fornecedor + valor + ✓ vencedora), abaixo do carimbo do Anderson.

### Fora de escopo agora
- Módulo "Nova RC" dentro de Compras (você disse: cada setor cria na sua área).
- Notificações WhatsApp automáticas (fica pro próximo ciclo).
- Dashboard financeiro / relatórios de economia (depois).

Confirma que tá redondo assim que eu já saio codando o pacote completo. 🚀
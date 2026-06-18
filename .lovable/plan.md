## Plano: OS integrada com assinador + cancelamento controlado

### 1. Painel OS (`/app/oss`) — ações por linha

Substituir o botão "Apagar" por um fluxo baseado em status:

- **PENDENTE_ASSINATURA**
  - `Assinar` (primário) → abre o assinador interno já com o PDF da OS carregado (sem download/upload manual)
  - `Visualizar PDF`
  - `Baixar PDF` (opcional, para o funcionário)
  - `Cancelar OS` (admin/moderador)
- **ASSINADO**
  - `Visualizar PDF assinado`
  - `Baixar`
  - `Cancelar OS` (admin/moderador) → exige nova emissão depois
- **SUBSTITUIDO / CANCELADO**
  - Somente `Visualizar` e `Baixar` (read-only, histórico)

Filtros:
- Padrão: oculta `CANCELADO` e `SUBSTITUIDO`
- Toggle "Mostrar arquivadas/canceladas" para auditoria
- Badges coloridos por status

### 2. Cancelamento de OS (sem delete)

Regra: **OS nunca é apagada** (documento legal NR-1). "Cancelar" = mudar status para `CANCELADO`.

- Permissão: `admin` **ou** `moderador`
- Modal obrigatório com:
  - Justificativa (textarea, mínimo 20 caracteres)
  - Confirmação dupla ("Digite CANCELAR para confirmar")
- Registra:
  - `cancelado_em`, `cancelado_por`, `motivo_cancelamento`
  - Entrada em `audit_logs` (já automático via trigger)
- Ao cancelar uma OS `ASSINADO` do cargo vigente do funcionário:
  - **Dispara pendência automática**: cria registro em `nao_conformidades` (ou tabela de pendências de OS) marcando "Funcionário X sem OS ativa para o cargo Y — emitir nova"
  - Funcionário fica visível em uma aba/badge "OS pendente" no painel
  - Sistema **não reativa** OS anterior automaticamente (mais seguro)

### 3. Assinador integrado ao fluxo OS

Botão `Assinar` no painel OS:
1. Gera/recupera o PDF da OS (já existe a geração)
2. Abre o `pdf-viewer-dialog` em modo assinatura, com PDF pré-carregado
3. Usuário assina (assinatura salva ou desenhada)
4. Ao confirmar:
   - Gera PDF assinado
   - Salva direto em `oss_emissoes.pdf_assinado_url` (storage)
   - Atualiza `status = 'ASSINADO'`, `data_assinatura`, `assinante_id`, `hash_pdf`
   - Fecha modal, atualiza painel
5. **Sem download/upload manual** — fluxo 1-clique

### 4. Ficha do funcionário → aba OS

- **OS vigente** em destaque (último `ASSINADO` para o cargo atual)
- Botão "Visualizar PDF assinado"
- Accordion "Histórico" com `SUBSTITUIDO` e `CANCELADO` (read-only)
- Badge "⚠ Sem OS ativa" quando cancelada e não reemitida
- Vinculação automática (mesma tabela `oss_emissoes`, mesma linha)

### 5. Migration necessária

```sql
ALTER TABLE public.oss_emissoes
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- Função RPC para cancelar com permissão e justificativa
CREATE OR REPLACE FUNCTION public.cancelar_os(
  _os_id uuid,
  _motivo text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_moderator(v_user) THEN
    RAISE EXCEPTION 'Apenas admin/moderador podem cancelar OS';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 20 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 20 caracteres)';
  END IF;
  UPDATE public.oss_emissoes
     SET status = 'CANCELADO',
         cancelado_em = now(),
         cancelado_por = v_user,
         motivo_cancelamento = _motivo,
         updated_at = now()
   WHERE id = _os_id;
END; $$;
```

### Arquivos a alterar

- `src/routes/app/oss.*` — botões de ação, filtros, modal de cancelamento, modal de assinatura integrada
- `src/components/pdf-viewer-dialog.tsx` — modo "assinatura embarcada" com callback de salvamento direto na OS
- `src/routes/app/employees/$id.tsx` (aba OS) — destacar OS vigente, accordion histórico, badge "sem OS ativa"
- Migration nova com colunas + função `cancelar_os`

### Ordem de execução

1. Migration (colunas + RPC)
2. Refactor do `pdf-viewer-dialog` para aceitar contexto OS e salvar direto
3. Painel OS: botões + modal de cancelamento + assinatura integrada
4. Aba OS na ficha do funcionário

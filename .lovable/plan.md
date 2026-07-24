# Fila Curta — Produtividade & Governança

Decisões travadas com você:
1. Snippets e templates ficam num menu novo em **Configurações → Produtividade** (rota `/app/configuracoes/produtividade`), com 3 abas: Snippets · Templates de Perfil · Anexos Padrão. Admin edita, usuário comum consome.
2. Snippets já vêm **semeados** com textos recorrentes de APR/OSS/Inspeção/Plano de Ação extraídos do histórico. Usuário pode **editar, duplicar ou criar novos** livremente (os do sistema ficam marcados como "oficiais" e não são apagáveis, mas dá pra clonar).
3. Anexos padrão podem ser **forçados pelo admin** — quando marcados como obrigatórios, o usuário não consegue desmarcar na hora de emitir o PDF.

---

## 1. Snippets (textos rápidos reutilizáveis)

**Banco** (migração nova):
- `snippets` — id, escopo (`apr` | `oss` | `inspecao` | `plano_acao` | `generico`), campo_alvo (ex: `descricao_atividade`, `medida_controle`), titulo, conteudo, oficial (bool), created_by, updated_at.
- RLS: leitura para todos os autenticados; escrita só para admin nos `oficial=true`; usuário comum cria/edita/apaga só os próprios.
- Seed: ~30 snippets tirados do histórico (frases mais repetidas em APR/OSS).

**UI:**
- Componente `<SnippetPicker escopo="apr" campo="descricao_atividade" onPick={...} />` — botão "⚡ Inserir texto rápido" ao lado de textareas relevantes em: wizard APR, wizard OSS, criar/editar inspeção, plano de ação.
- Tela de gestão: `/app/configuracoes/produtividade` aba **Snippets** — CRUD, filtro por escopo, marca oficial.

## 2. Templates de Perfil RBAC

**Banco:**
- `role_templates` — id, nome (ex: "TST Pleno", "Enc. Produção", "Almoxarife"), descricao, roles (jsonb array), modulos (jsonb array), menus (jsonb array), oficial (bool).
- Seed com 5-6 perfis padrão baseados no que já roda hoje (TST, Medicina, RH, Almoxarife, Portaria, Supervisor Geral).

**UI:**
- No wizard de convite (`/app/users`), botão **"Usar template"** popula roles/módulos/menus de uma vez. Usuário ajusta se quiser antes de enviar.
- Aba **Templates de Perfil** na tela de produtividade — só admin edita.

## 3. Anexos Padrão em PDFs

**Banco:**
- `pdf_anexos_padrao` — id, escopo (`apr` | `oss` | `pte` | `dds` | `os` | `rc`), titulo, arquivo_path (Storage), obrigatorio (bool), ativo (bool), ordem.
- Bucket novo `pdf-anexos-padrao` (privado, admin escreve, todos leem via signed URL).

**UI:**
- No momento da emissão de cada PDF que suporta anexo (APR, OSS, PTE, DDS, OS, RC), aparece bloco **"Anexos padrão"** listando os disponíveis pro escopo. Os `obrigatorio=true` vêm marcados e **desabilitados** (usuário não desmarca). Os opcionais vêm marcados por padrão mas podem ser desmarcados.
- Geração de PDF concatena os anexos ao final usando pdf-lib (já usado no projeto).
- Aba **Anexos Padrão** na tela de produtividade — só admin upload/marca obrigatório.

## 4. Widget de Ajuda Contextual "?"

Já existe `<HelpHint topic="..." />` (baseado em `src/lib/help-content.ts`). Vou:
- Ampliar o catálogo com ~40 novos tópicos cobrindo campos críticos dos wizards (APR, OSS, PGR, Psicossocial, RC, Inspeção).
- Espalhar `<HelpHint>` ao lado dos labels dos campos que mais geram dúvida (baseado no histórico de "campos preenchidos errado").
- Sem mudança de schema — só conteúdo + posicionamento.

---

## Onde você verá tudo isso depois

- **Snippets**: botão ⚡ ao lado dos textareas de APR/OSS/Inspeção/Plano; gestão em `/app/configuracoes/produtividade → Snippets`.
- **Templates de Perfil**: botão "Usar template" no wizard de convite em `/app/users`; gestão em `/app/configuracoes/produtividade → Templates de Perfil`.
- **Anexos Padrão**: bloco "Anexos padrão" no dialog de emissão de PDF (APR, OSS, PTE, DDS, OS, RC); gestão em `/app/configuracoes/produtividade → Anexos Padrão`.
- **Widget "?"**: iconezinho de interrogação ao lado dos labels nos wizards; já vai pra Central de Ajuda existente.

---

## Ordem de execução (numa tacada só)

1. Migração única com as 3 tabelas + bucket + seeds.
2. Rota `/app/configuracoes/produtividade` com as 3 abas de gestão.
3. `<SnippetPicker>` plugado nos wizards de APR e OSS (primeiros consumidores).
4. Botão "Usar template" no convite de usuário.
5. Bloco "Anexos padrão" no gerador de PDF de OSS e APR (primeiros a receber).
6. Ampliação do catálogo `help-content.ts` e distribuição de `<HelpHint>` nos wizards.

Inspeção, Plano de Ação, PTE, DDS, OS e RC entram numa segunda passada plugando os mesmos componentes — a base fica pronta nesta rodada.

Toca pau?

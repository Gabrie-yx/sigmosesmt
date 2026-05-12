## Objetivo

Reformular a tela de emissão da APR para ficar **visualmente idêntica** ao documento físico homologado (cabeçalho DMN vermelho, blocos com bordas, cabeçalho de tabela laranja, cores de risco), com os mesmos campos, mesma ordem e mesma diagramação das 5 páginas do papel. O PDF gerado já segue esse layout — vamos alinhar a tela de preenchimento ao mesmo padrão e ajustar os campos que faltam.

## Estrutura final da APR (5 páginas, espelhando o papel)

**Página 1 — Identificação + Tabela de Riscos**
- Cabeçalho: Logo DMN | Razão social + "APR – Análise Preliminar de Riscos" | Bloco ISO (Cód./Rev./Data/Pág.)
- Linha de identificação: CNPJ | Início | Fim | APR Nº | Elaborado
- Atividade Principal | Serviço Detalhado
- **Elaborado por** (seletor de funcionário — TST) | **Responsável pelo Serviço** (seletor de **empresa** cadastrada) | **Local da Atividade** | Horário (Seg–Qui / Sexta)
- Tabela de riscos: Passo a Passo | Riscos Identificados | Efeitos/Danos | P | S | G | Ações Preventivas | EPI | Responsáveis | NRs

**Página 2 — GERAIS**
- Texto padrão (10 itens de orientação + comportamentos inaceitáveis), editável.

**Página 3 — Avaliação de Risco + Assinaturas**
- Legenda dos riscos ambientais (Físico, Químico, Biológico, Ergonômico, Mecânico)
- Hierarquia (CA / EPC / EPI)
- Bloco "AVALIAÇÃO DO RISCO" com Probabilidade (Baixa/Média/Alta) e Severidade (Baixa/Média/Alta) coloridas
- Grau do Risco: Trivial (2) → Inaceitável (6) com cores
- Caixas de assinatura: TST | Responsável pelo Serviço

**Página 4 — Anexo I: Assinatura dos Executantes**
- Tabela Nº | Nome | Assinatura
- **Lista preenchida automaticamente** com os funcionários ativos da empresa selecionada em "Responsável pelo Serviço"
- Usuário pode **desmarcar** quem não vai executar antes de salvar

## Mudanças no Formulário (`src/components/aprs/apr-form.tsx`)

Reescrever a tela em **abas/passos visuais** que espelham as páginas do papel:

1. **Aba "Identificação"** (página 1 do papel)
   - Cabeçalho DMN replicado no topo do formulário (vermelho + nome estaleiro + bloco ISO)
   - Campos na mesma ordem e diagramação do papel, com bordas pretas finas
   - "Responsável pelo Serviço" → `<Select>` de empresas (`companies`)
   - "Elaborado por" → `<Select>` de funcionários (mesma lista TST)
   - "Local da Atividade" (renomear o campo atual `local`)
   - Horário: 2 pares (Seg–Qui início/fim, Sexta início/fim)

2. **Aba "Riscos"** (página 1 — tabela)
   - Tabela com cabeçalho laranja idêntico ao papel
   - Coluna G colorida conforme P+S (verde→vermelho)
   - Linhas adicionáveis com seleção do catálogo de riscos

3. **Aba "Gerais"** (página 2)
   - Textarea com o texto padrão pré-carregado, editável.

4. **Aba "Avaliação & Assinaturas"** (página 3)
   - Mostrar a legenda colorida (somente leitura, igual ao papel)
   - TST e Responsável pelo Serviço já vêm dos campos da aba 1 (somente exibição).

5. **Aba "Executantes"** (página 4)
   - Ao mudar "Responsável pelo Serviço" (empresa) na aba 1, lista todos os `employees` ativos dessa empresa
   - Cada funcionário vem com checkbox **marcado por padrão**; usuário desmarca quem não vai executar
   - Ao salvar, gera `apr_assinaturas` (papel = `EXECUTANTE`) só dos marcados

## Mudanças no Banco

Apenas dois ajustes pequenos em `aprs`:

- `hora_inicio_sexta TIME NULL`
- `hora_fim_sexta TIME NULL`

(Mantemos `hora_inicio` / `hora_fim` como Seg–Qui.)

Nada mais muda na estrutura — `empresa_id`, `tst_id`, `apr_assinaturas` etc. já existem.

## Mudanças no PDF (`src/lib/apr-pdf.ts` e `apr-pdf-loader.ts`)

- Página 1: usar os 2 pares de horário (Seg–Qui / Sexta) na célula "Horário"
- "Responsável pelo Serviço" puxa de `companies.name` (já implementado, só garantir)
- Página 4 (Anexo I): listar **somente os executantes marcados** (já é o comportamento — só garantir que a tela escreva corretamente em `apr_assinaturas`)
- Restante do PDF já está fiel ao papel.

## Detalhes técnicos

- Layout do formulário usa `<div>` com `border border-black`, cabeçalhos com `bg-[#dc3545] text-white` (vermelho DMN) e tabela com `bg-[#ff9900]` (laranja) — mantemos coerência com o PDF.
- Tokens novos em `src/styles.css`: `--apr-red`, `--apr-orange`, `--apr-cream` (usados só dentro do formulário/preview da APR — não afeta o resto do app).
- Seletor de empresa e de funcionário usam `Select` shadcn (igual TST atual) com busca.
- Ao trocar a empresa, dispara um `useEffect` que recarrega os funcionários ativos e marca todos por padrão.

## Não muda

- Estrutura de rotas, autenticação, RLS, demais módulos.
- Catálogo de riscos, NRs, EPIs.
- Lógica de geração de número da APR e validade.

## Próximo passo

Se você aprovar, eu:
1. Crio a migration dos 2 campos de horário de sexta.
2. Reescrevo o `apr-form.tsx` com as 5 abas espelhando o papel.
3. Ajusto o PDF para usar os 2 pares de horário.
4. Mostro o resultado pra você validar antes de qualquer outra coisa.
# SIGMO genérico: Cascos viram "Locais de trabalho"

## Objetivo
Tirar a cara de estaleiro do SIGMO sem perder nenhum dado. O cadastro de Cascos passa a ser **Locais de trabalho**, servindo qualquer segmento (obra, loja, fábrica, escritório, frota).

## O que o usuário vai ver
- Menu "Cascos" passa a se chamar **Locais de trabalho** (mesma tela, textos neutros: nome/código, descrição, endereço/área, responsável).
- APR e PT: campo **Local de trabalho** com o "melhor dos dois mundos":
  - escolher um local cadastrado, **ou**
  - digitar um local livre (ex.: "Escritório central - 2º andar") quando não houver cadastro.
  - Um dos dois é obrigatório (a NR exige identificar onde o serviço ocorre), mas o cadastro não é.
- Seletor de APR na PT: "Local / nº APR".
- PTs simultâneas: cruzadas pelo mesmo local (cadastrado ou texto igual) e mesmo dia.
- PDFs de APR e PT, painéis de APRs/PTs Executadas, Inspeções, busca, ajuda e breadcrumbs: "Casco" vira "Local".
- APRs/PTs antigas continuam mostrando o local delas (o antigo casco), nada se perde.

## Fora do escopo
- Menu Produção (ignorado, fica como está).
- Qualquer coisa de servidor DMN (não existe mais).

## Detalhes técnicos
- Banco: manter tabela `cascos` e colunas `casco_id` (sem rename, evita quebrar RLS/FKs). Adicionar `local_texto text` em `aprs` e `ptes`. Sem perda de dados.
- Rótulos centralizados em `src/lib/local-labels.ts` (singular/plural/curto) para futura personalização por empresa.
- Validação APR/PT: `casco_id || local_texto.trim()` obrigatório.
- Arquivos: app.cascos.tsx, cascos-form.tsx, app.aprs.tsx, apr-form.tsx, apr-pdf.ts/loader, revalidar/aplicar-modelo-lote, aprs-executadas-panel, app.ptes.tsx, PtPdfPreview, pts-executadas-panel, pte-lookup-sheet, inspeções, menu-catalog, app-sidebar, command-palette, smart-breadcrumb, help-content, module-guard.
- Rota `/app/cascos` mantida (links salvos funcionam).
- Remover do AGENTS.md as regras do servidor DMN.

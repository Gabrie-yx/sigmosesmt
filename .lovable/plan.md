## Novo Laudo Técnico de Inspeção SST (13-14 páginas)

Reescrita do `src/lib/inspecao-pdf.ts` mantendo a assinatura da função `gerarInspecaoPdf` (nenhuma tela precisa mudar), e ajustes pontuais no `PDFPreviewDialog` para 3 assinaturas.

### Decisões confirmadas
- **Assinaturas**: Engenheiro de Segurança, Técnico de Segurança (usuário logado), Encarregado da área. Três slots.
- **Multa NR-28**: valor **exato por faixa legal** conforme Portaria MTP 667/2021 (Anexo I e II da NR-28), usando `companies.numero_empregados` × grau de risco da NR infringida × gradação (I1-I4). O valor sai da tabela oficial, não da faixa "de-até". Notinha explicando base legal.
- **QR code**: **não** incluir.

### Estrutura do PDF

1. **Capa (pág. 1)** — Cabeçalho vinho DMN, título "LAUDO TÉCNICO DE INSPEÇÃO DE SEGURANÇA DO TRABALHO", empresa/CNPJ/local/data/inspetor, big numbers (NCs, Críticas, Multa total NR-28), nº do laudo (`INSP-{id-curto}-{ano}`), marca d'água "PRÉVIA" se rascunho.

2. **Sumário Executivo (pág. 2)** — Parágrafo introdutório automático + tabela consolidada (NCs por classe de risco, NCs por NR, exposição financeira NR-28).

3. **Metodologia e Base Legal (pág. 3)** — NR-01 (GRO/PGR), NR-28 (fiscalização/gradação), matriz 5×5, critérios de severidade/probabilidade, escopo declarado. Blindagem jurídica.

4. **Quadro Consolidado de NCs (pág. 4)** — Tabela: #, NR-Item, Descrição resumida, Classe, P×S, Gradação NR-28, Multa R$.

5. **Detalhamento por NC (págs. 5-N, uma por página quando possível)** — Para cada NC:
   - Cabeçalho: "NC #X — NR-YY item Z.z"
   - Texto oficial do item normativo (do `catalogo_nrs_itens.texto_oficial`)
   - Descrição da não conformidade (do inspetor)
   - Foto(s) associada(s) com legenda (hash, timestamp, GPS)
   - Matriz 5×5 SVG desenhada em vetor, célula ativa destacada
   - Recomendação técnica
   - Plano 5W2H (What/Why/Who/Where/When/How/HowMuch) extraído dos `planos_acao`
   - Multa NR-28 calculada com base + fórmula

6. **Plano de Ação Consolidado (pág. N+1)** — Tabela com todas as ações de todas as NCs ordenadas por prazo, status PDCA.

7. **Rubrica Matriz 5×5 (pág. N+2)** — Tabelas de P e S com definições.

8. **Parecer Técnico e Conclusão (pág. N+3)** — Parecer do inspetor (usa `inspecao.parecer_tecnico` se existir; senão gera texto padrão), classificação geral do risco, urgência.

9. **Assinaturas (última pág.)** — 3 slots: Engenheiro de Segurança, Técnico de Segurança do Trabalho (nome + CREA/registro do usuário), Encarregado da Área. Base legal ao pé.

10. **Rodapé em todas as páginas**: `LAUDO INSP-xxx · Página X/Y · Emitido em DD/MM/YYYY HH:MM`.

### Cálculo de multa NR-28 (Portaria MTP 667/2021)

Valor U (UFIR-like) por gradação I1..I4 × faixa de empregados (Anexo II). Vou criar um helper `src/lib/nr28-multa.ts` com a matriz completa oficial e função `calcularMultaNR28({ gradacao: 'I1'|'I2'|'I3'|'I4', numeroEmpregados: number })`. O cálculo já existe hoje via `inspecao_nr28_valores` — vou consultar essa tabela para não duplicar, e só fazer fallback pro helper caso vazia.

### Ajustes no dialog
`PDFPreviewDialog` hoje aceita 2 slots (`encSig`/`sesmtSig`). Preciso estender para 3: adicionar `engSig`/`onChangeEngSig` (opcional, retrocompatível). No `app.sesmt.inspecoes.$id.tsx` passar os 3 handlers.

### Arquivos afetados
- `src/lib/inspecao-pdf.ts` — reescrita completa (~600 linhas)
- `src/lib/nr28-multa.ts` — novo, helper de fallback
- `src/components/pdf-preview-dialog.tsx` — 3º slot de assinatura
- `src/routes/app.sesmt.inspecoes.$id.tsx` — passar 3 assinaturas e labels ("Engenheiro de Segurança", "Técnico de Segurança", "Encarregado da Área"), buscar CREA do TST logado se disponível

### Fora de escopo
- Rota pública `/laudo/{hash}` (usuário dispensou)
- QR code
- Anotação em fotos (bounding boxes) — fica para uma iteração seguinte, é complexo e não bloqueia legalidade
- Gráfico Gantt do plano de ação (tabela ordenada por prazo já cumpre)

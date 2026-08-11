# Plano: Quadro Estatístico de Acidentes de Trabalho (FOR-SEG 09)

Implementação de um painel estatístico dinâmico e exportação em PDF, baseado no formulário **FOR-SEG 09**, atendendo às exigências da **NR-04 (Quadro IV)** e **ISO 45001**.

## Pesquisa e Levantamento Técnico

O quadro apresentado na imagem (FOR-SEG 09) é a representação prática do **Quadro IV da NR-04**, que estabelece a obrigatoriedade do registro de acidentes com e sem vítima.

### Principais Indicadores Requeridos:
1.  **HHT (Horas Homens Trabalhadas):** Somatório das horas de exposição ao risco de todos os empregados.
2.  **Taxa de Frequência (TF):** `(Nº de acidentes * 1.000.000) / HHT`. Representa quantos acidentes ocorrem para cada 1 milhão de horas trabalhadas.
3.  **Taxa de Gravidade (TG):** `(Dias Perdidos + Dias Debitados) * 1.000.000 / HHT`. Representa a severidade das lesões.
4.  **Índice Relativo Total de Empregados:** Proporção de acidentados em relação ao efetivo.
5.  **Óbitos:** Registro de fatalidades.

### Legislações Aplicáveis:
-   **NR-04 (SESMT):** Define os quadros estatísticos anuais.
-   **NBR 14280:** Cadastro de acidentes do trabalho - Procedimentos e estatísticas.
-   **ISO 45001 (item 9.1):** Monitoramento, medição e análise de desempenho.

## Implementação no SIGMO

O módulo será implementado no menu **SESMT / Painel**, com uma nova rota dedicada para visualização e geração do documento oficial.

### 1. Estrutura de Dados
O sistema já possui as tabelas `acidentes_trabalho` e `hht_mensal`. O motor de cálculo consolidará:
-   `Nº Absoluto`: Contagem total de acidentes no mês.
-   `Com Afastamento <= 15 dias`: Acidentes com dias perdidos entre 1 e 15.
-   `Com Afastamento > 15 dias`: Acidentes com dias perdidos > 15 (foco previdenciário).
-   `Sem Afastamento`: Acidentes típicos onde o colaborador retorna no mesmo dia ou dia seguinte sem perda de jornada.

### 2. Componentes e Rotas
-   **Rota:** `/app/sesmt/quadro-estatistico`
-   **Componente:** `QuadroEstatisticoPage` - Uma interface que imita o layout do Excel/Papel para conferência antes da exportação.
-   **PDF Engine:** `src/lib/quadro-estatistico-pdf.ts` - Gerador nativo em jsPDF seguindo o layout exato do FOR-SEG 09 (cabeçalho DMN, grid 12 meses, campos de CNAE e Grau de Risco).

### 3. Visualização e UX
-   Integração no **Sidebar** sob o grupo "Relatórios / SESMT".
-   Utilização do `PDFPreviewDialog` para visualização in-app (sem novas abas), garantindo a conformidade com a regra de design do SIGMO.
-   Auto-preenchimento dos dados da empresa (CNPJ, CNAE, Endereço) a partir da tabela `companies`.

## Detalhes Técnicos (para o time)
-   **Backend:** SQL Functions ou Server Functions para agregar acidentes por mês/tipo e cruzar com HHT mensal.
-   **Frontend:** Shadcn UI Tables para a visualização web.
-   **PDF:** Posicionamento absoluto via jsPDF para bater com o formulário físico enviado pelo usuário.

# Plano de Implementação: Quadro Estatístico de Acidentes (FOR-SEG 09)

O objetivo é ajustar o Quadro Estatístico de Acidentes para permitir alimentação manual e gerar o PDF exatamente conforme o template FOR-SEG 09 fornecido.

## 1. Ajustes no Banco de Dados (Supabase)
*   **Tabela `hht_mensal`**: Já existe, mas vamos garantir que ela comporte os campos necessários para o cálculo do Quadro Estatístico: `numero_empregados`, `hht`, `ano`, `mes`, `company_id`.

## 2. Ajustes na Interface (TanStack Start)
*   **Menu Acidentes de Trabalho**:
    *   Criar aba "Quadro Estatístico" (já iniciada, mas precisa de refinamento).
    *   Implementar botão para abrir o diálogo de HHT diretamente da aba.
    *   Exibir a tabela do Quadro Estatístico com os campos do print (Nº Empregados, HHT, Acidentes por tipo, Dias Perdidos, TF, TG).
*   **Diálogo HHT**:
    *   Permitir entrada manual do número médio de empregados.
    *   Garantir que ao salvar o HHT, a tabela do quadro estatístico seja atualizada via cache do TanStack Query.

## 3. Geração de PDF (jsPDF + autoTable)
*   Refatorar `gerarForSeg09` em `src/lib/pdf-acidentes.ts`:
    *   Ajustar cabeçalho para conter o layout do print (Logotipo, DMN Estaleiro, Código FOR-SEG 09, Revisão, Data, Página).
    *   Ajustar colunas da tabela: Mês, Número de empregados, HHT, Nº Absoluto, Nº Absoluto com afastamento <= 15 dias, Nº Absoluto com afastamento > 15 dias, Nº Absoluto sem Afastamento, Índice Relativo total de empregados, Dias / homens Perdidos, Taxa de frequência, Óbitos.
    *   Implementar a linha de "Total" formatada.
    *   Adicionar campo de assinatura para o "RESPONSÁVEL".

## Detalhes Técnicos
*   **Cálculos NBR 14280**:
    *   TF (Taxa de Frequência) = (Acidentes com afastamento * 1.000.000) / HHT.
    *   TG (Taxa de Gravidade) = (Dias perdidos + debitados * 1.000.000) / HHT.
    *   Índice Relativo = (Nº Acidentes / Nº Médio Empregados).
*   **Visualização**: Garantir que o PDF abra dentro do sistema usando `PDFPreviewDialog` (seguindo a diretriz de memória Core).

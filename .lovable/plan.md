# Requisição de Medicamentos — Plano A + B

Vamos fazer em 2 fases, entregando valor já na Fase A e evoluindo na Fase B sem retrabalho.

---

## FASE A — Integrar ao módulo Requisições (entrega imediata)

**Objetivo:** salvar, listar, reabrir, editar, gerar PDF de novo e assinar — usando a infra que já existe.

### O que muda na UI
- Botão **"💊 Medicamentos Ambulatório"** em `/app/sesmt/requisicoes` ganha 2 ações no modal:
  - **Visualizar** (já existe) — só pré-visualiza
  - **Baixar PDF** (já existe) — só baixa
  - **➕ Salvar no SIGMO** (NOVO) — grava na tabela `purchase_requisitions` e fecha o modal
- A requisição salva aparece na **lista de requisições** com um chip rosa **💊 MEDICAMENTOS** para diferenciar de MATERIAL/SERVIÇO.
- Filtro de classificação ganha a opção **MEDICAMENTOS**.
- Clicar numa requisição salva reabre o **mesmo modal** com os itens carregados → editar, salvar de novo, gerar PDF, assinar.
- Assinatura usa o **`pdf-signer-dialog`** já existente (mesmo fluxo de ASO/OS).

### Onde a requisição fica salva
- Tabela: `purchase_requisitions` (a mesma das outras)
- Classificação nova: `MEDICAMENTOS` (adicionada ao enum)
- Itens em `purchase_requisition_items` (já existe)
- Status: PENDENTE → COTADA → APROVADA → INDEFERIDA (igual às outras)
- Aparece em **/app/sesmt/requisicoes** com chip rosa

### Técnico (Fase A)
1. Migration: `ALTER TYPE purchase_req_class ADD VALUE 'MEDICAMENTOS';`
2. Refatorar `requisicao-medicamentos-dialog.tsx`:
   - aceitar prop `requisitionId?` (modo edição)
   - carregar itens existentes quando id é passado
   - botão "Salvar no SIGMO" → INSERT/UPDATE em `purchase_requisitions` + `purchase_requisition_items` com `classificacao='MEDICAMENTOS'`
3. Em `app.sesmt.requisicoes.tsx`:
   - card de requisição com classificação MEDICAMENTOS abre o dialog de medicamentos (não o genérico)
   - chip rosa visual, contador no header
4. Reaproveitar `pdf-signer-dialog` no botão "Assinar"

---

## FASE B — Mini-módulo Ambulatório (evolução futura)

**Quando:** depois que a Fase A estiver rodando 2-3 semanas e você decidir que vale a pena ter controle de estoque do ambulatório.

**O que ganha:**
- Tela própria `/app/sesmt/ambulatorio` no menu SESMT
- Tabela `ambulatorio_estoque` com saldo atual de cada item (entrada via requisição aprovada, saída via atendimento)
- Tabela `ambulatorio_atendimentos` — registro de "Funcionário X recebeu 2 dipironas em DD/MM"
- Alerta de **estoque mínimo** (card no /app/hoje quando saldo < mínimo)
- Controle de **validade por lote** (alerta 60 dias antes do vencimento)
- Integração com PCMSO: histórico de atendimentos vai pra ficha do funcionário
- Relatório mensal de consumo (PDF) — útil pro relatório NR-07

**O que NÃO muda da Fase A:** as requisições continuam na mesma tabela `purchase_requisitions`. A Fase B só consome o resultado (requisição APROVADA → entrada de estoque automática).

---

## Entrega

- **Hoje:** Fase A completa, testada, com migration. Você consegue salvar a requisição que já gerou hoje pra dentro do sistema.
- **Quando você pedir:** Fase B.

Confirma que mando bala na Fase A agora?

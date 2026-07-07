## Objetivo

Implementar o **Pacote de Rescisão SST** — fluxo estruturado, auditável e conforme NR-01 / NR-07 / NR-06 / ISO 9001 (evidência objetiva) e ISO 45001 (gestão da mudança), disparado no momento do desligamento, com preservação legal de todos os documentos.

## Base legal / referências

- **NR-01 (1.4.1 "c" / 1.5.4)**: rastreabilidade das ações de SST e evidência da comunicação de riscos até o encerramento do vínculo.
- **NR-07 (7.5.15.4)**: ASO Demissional obrigatório (exceto se último ASO ≤ 135 dias em grau de risco 1/2, ou ≤ 90 dias em 3/4).
- **NR-06 (6.6.1)**: devolução dos EPIs e evidência formal.
- **CLT art. 168 §2º + Portaria 1.999/2011**: PPP entregue ao trabalhador no ato do desligamento.
- **ISO 9001 §7.5 / 8.5.3** e **ISO 45001 §7.5 / 8.1.3**: informação documentada preservada + controle de mudança (saída de pessoa = mudança planejada).
- **Retenção**: ASO 20 anos · PPP permanente · EPI 5 anos · Treinamentos NR-33/34/35 5 anos · OS 5 anos pós-contrato.

## O que muda no fluxo

Hoje o `DesligamentoDialog` apenas marca `status=DESLIGADO`, grava checklist livre e a RPC substitui OSs. **Não há evidência agregada, não gera pacote, não bloqueia se falta ASO, e o PPP fica solto.**

O novo fluxo transforma o desligamento num **wizard de 4 passos** que produz um **Pacote de Rescisão** (registro único imutável com evidências vinculadas), impossível de fechar sem os itens obrigatórios da NR.

## Wizard (4 passos)

```text
[1] Motivo + Data           →  valida data ≤ hoje e ≥ admissão
[2] ASO Demissional         →  detecta grau de risco (via cargo/PGR)
                               • se exigido: exige upload ASO OU nº de dispensa
                               • bloqueia avanço se pendente
[3] EPIs · Documentos       →  lista EPIs em posse (epi_deliveries)
                               marca devolvidos + gera Termo de Devolução PDF
                               lista OSs ativas do funcionário (viram SUBSTITUIDO)
[4] PPP + Confirmação       →  gera rascunho PPP pré-preenchido (usa ppp_emissoes)
                               resume tudo, exige checkbox "informações verídicas"
                               → cria registro em desligamento_pacotes
                               → chama RPC estendida
                               → oferece download do dossiê ZIP-like (PDFs)
```

## Alterações técnicas

### Banco (uma migration)

- Tabela nova `desligamento_pacotes` (id, employee_id, data_desligamento, motivo, aso_id?, aso_dispensado boolean + justificativa, ppp_emissao_id?, epis_devolvidos jsonb, termo_epi_url?, oss_afetadas jsonb, checklist jsonb, sha256_snapshot text, criado_por, criado_em). RLS + GRANT padrão.
- Estender RPC `registrar_desligamento_funcionario` para receber `_pacote_id`, gravar snapshot em `audit_logs` (action `RESCISAO_PACOTE_EMITIDO`).
- View `v_desligamento_pendencias` (funcionários DESLIGADO sem pacote fechado) → alimenta card no `/app/hoje`.

### Frontend

- `src/components/employees/desligamento-wizard.tsx` (novo, substitui a chamada do dialog atual — mantém o botão).
- `src/lib/rescisao-pacote-pdf.ts` (novo) — gera **Termo de Encerramento SST** (capa) + Termo de Devolução EPI + lista de OSs preservadas.
- Ajuste em `DesligadosPage` (card) para mostrar badge "Pacote OK" ou "Pacote pendente" e link para reabrir o wizard e concluir.
- Reuso: `PPPEditorDialog` (rascunho pré-preenchido), `epi-termo-perda-pdf.ts` como base do Termo de Devolução.

## O que **NÃO** entra agora

- eSocial S-2299 (fora do escopo do TST — deixamos slot para futuro).
- Emissão automática de ASO Demissional (é ato médico) — o wizard só **exige o upload/registro**.
- Geração final do PPP assinado (permanece com o RH; o wizard entrega o rascunho pronto).

## Ordem de entrega

1. Migration (tabela + RPC + view + GRANT + RLS).
2. Gerador do Termo de Encerramento SST + Termo Devolução EPI.
3. Wizard de 4 passos + integração no botão atual "Registrar desligamento".
4. Card de pendências em `/app/hoje` + badge no painel Desligados.

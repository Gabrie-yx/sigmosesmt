# Modal dinâmico das Unidades (Cascos → Obra, Loja, Frota…)

Tirar do modal tudo que é de estaleiro e colocar no lugar um **construtor de campos**: você cria os campos, escolhe o tipo, a máscara, a aba onde aparece e a ordem — o modal se monta sozinho.

## Fluxograma

```text
CONFIGURAÇÃO (admin)                    USO DO DIA A DIA
┌──────────────────────────┐            ┌──────────────────────────┐
│ Vocabulário: "Obra"      │──rótulo──▶ │ Menu: Obras              │
│                          │            │ Botão: Nova Obra         │
│ Construtor de campos     │──campos──▶ │ Modal em abas:           │
│  • aba  • rótulo         │            │  [Dados][Empresa]        │
│  • tipo + máscara        │            │  [Contatos][Prazos]      │
│  • obrigatório  • ordem  │            │                          │
│  • mostrar na lista      │──colunas─▶ │ Tabela da listagem       │
└──────────────────────────┘            └──────────────────────────┘
            │                                      │
            └────────── mesmo registro ────────────┘
                   (valores em um só campo do banco)
```

## Esqueleto fixo (não entra no construtor)

Identificação, empresa dona, status (Ativa/Pausada/Encerrada) e datas de início/fim.
São o que PGR, APR, PT, inspeções e relatórios enxergam. Todo o resto é seu.

## Tipos de campo e máscaras

| Tipo | Comportamento |
|---|---|
| Texto / Texto longo | livre |
| Número | só dígitos, casas decimais configuráveis |
| Moeda | R$ 0.000,00 |
| Data / Hora | seletor nativo, exibição dd/mm/aaaa |
| Lista de opções | opções que você cadastra |
| Sim/Não | chave liga-desliga |
| Telefone / WhatsApp | (00) 00000-0000 — WhatsApp vira link clicável |
| E-mail | validação + link clicável |
| CPF | 000.000.000-00 com validação de dígito |
| CNPJ | 00.000.000/0000-00 com validação de dígito |
| CEP | 00000-000 |
| Anexo | upload para o armazenamento do SIGMO |
| Vínculo | escolher uma pessoa cadastrada (ex.: Encarregado) |

Campo obrigatório bloqueia o salvamento com aviso na aba certa.

## Telas

1. **Construtor de campos** — dentro de Configurações → Centro de Configuração, nova aba "Campos das Unidades". Criar/editar abas, arrastar campos para reordenar, marcar obrigatório e "mostrar na lista" (até 4).
2. **Modal da unidade** — abas dinâmicas + aba fixa "Identificação". Salva e valida conforme a definição.
3. **Listagem** — colunas fixas (identificação, empresa, status, datas) + as marcadas para exibir.

## Regras acertadas

- Campo apagado: some das telas, o valor antigo continua guardado — sem coluna nova, sem código novo.
- Campos por empresa (definição global serve de padrão quando a empresa não tem a sua).
- Registros de casco atuais: apagados, depois de eu listar o que estiver amarrado neles para você confirmar.
- Campos navais (Armador, Tipo de Embarcação, Comprimento, Licença) saem do formulário; as colunas do banco ficam paradas, sem uso, e o servidor DMN continua intacto.

## Detalhes técnicos

- Migração aditiva: tabela `unidade_campos` (`company_id` nulo = global, `aba`, `chave`, `label`, `tipo`, `obrigatorio`, `ordem`, `opcoes` jsonb, `mostrar_lista`, `ativo`) com GRANTs, RLS (leitura autenticado, escrita admin) e trigger de `updated_at`; coluna `campos_extras jsonb` em `cascos`.
- `src/lib/campos-dinamicos.ts`: catálogo de tipos, máscaras, validadores (CPF/CNPJ/e-mail) e formatadores.
- `src/components/cascos/campo-input.tsx`: renderiza um campo pelo tipo.
- `src/components/cascos/cascos-form.tsx`: reescrito com `Tabs` + campos fixos + dinâmicos.
- `src/components/config/campos-builder.tsx`: construtor, com reordenação por arrastar.
- `src/routes/app.cascos.tsx`: botão e títulos via `useRotulo` (com gênero o/a), colunas extras na tabela.
- Nada disso vale no servidor DMN — `IS_BACKEND_LOCAL` mantém o comportamento atual lá.

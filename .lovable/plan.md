# Centro de Configuração do SIGMO — tornar o sistema multissegmento

Objetivo: tudo que muda de empresa para empresa (rótulos, listas, riscos, EPIs, treinamentos, menus, documentos) vira cadastro editável por você numa tela. O que é lei (NR, cálculos, assinaturas, auditoria) continua fixo no código.

## Fluxograma da arquitetura

```text
                    ┌──────────────────────────┐
                    │  EMPRESA (cadastro)      │
                    │  ramo + rótulos + logo   │
                    └────────────┬─────────────┘
                                 │ define
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐    ┌──────────▼─────────┐   ┌──────────▼─────────┐
│ 1. VOCABULÁRIO │    │ 2. CATÁLOGOS       │   │ 3. MÓDULOS         │
│ Casco → Loja   │    │ riscos, EPIs,      │   │ liga/desliga menu  │
│ Setor → Área   │    │ exames, cursos,    │   │ por empresa        │
│ (rótulos)      │    │ temas DDS, NRs     │   │                    │
└───────┬────────┘    └──────────┬─────────┘   └──────────┬─────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │ consumidos por
                    ┌────────────▼─────────────┐
                    │ NÚCLEO FIXO (não muda)   │
                    │ PGR · APR · PT · DDS ·   │
                    │ ASO · EPI · Treinamento ·│
                    │ Incidentes · Indicadores │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │ 4. PACOTES DE RAMO       │
                    │ semente inicial: importa │
                    │ catálogos prontos → você │
                    │ edita depois à vontade   │
                    └──────────────────────────┘
```

Regra de ouro do fluxo: **pacote de ramo só semeia; depois disso, quem manda é o cadastro da empresa.** Nunca há sobrescrita automática.

## Revisão do fluxograma — falhas encontradas e como resolver

1. **Empresa vs. instalação.** Hoje há várias empresas no mesmo banco. Se o rótulo for por empresa, um usuário que vê duas empresas vê dois vocabulários. Decisão: rótulos e módulos ficam por empresa, com um padrão global na tabela de configuração; a tela mostra o rótulo da empresa selecionada no filtro.
2. **Dado histórico com rótulo antigo.** Se "Casco" virar "Loja", PDFs já emitidos continuam dizendo Casco. Decisão: rótulo é lido no momento da impressão; documentos já assinados guardam o texto congelado. Nada é reescrito retroativamente.
3. **Excluir item de catálogo em uso.** Apagar um risco usado num PGR quebraria histórico. Decisão: catálogos usam *ativo/inativo*, nunca exclusão física quando há vínculo.
4. **Módulo desligado com pendência aberta.** Desligar Almoxarifado com fila de EPI pendente esconderia trabalho. Decisão: ao desligar, o sistema avisa quantos registros abertos existem e exige confirmação.
5. **IS_BACKEND_LOCAL vs. configuração no banco.** Hoje o menu é escondido por código. Com a nova tela isso vira dado; risco de conflito. Decisão: precedência clara — servidor DMN (backend local) ignora a tabela e mantém tudo ligado; na nuvem manda a tabela.
6. **Permissão.** Se qualquer usuário abrir o Centro de Configuração, ele desliga o SESMT inteiro. Decisão: acesso só para administrador, com registro em auditoria de toda mudança.
7. **Cascos já existem como tabela e telas.** Renomear a tabela quebraria APR, PT e permissões. Decisão: tabela e código continuam com o nome atual; muda apenas o rótulo exibido. Zero migração destrutiva.
8. **Ramo aplicado duas vezes.** Clicar de novo em "aplicar pacote" duplicaria riscos. Decisão: importação idempotente por chave do item, com relatório "X novos, Y já existiam".

## Fases de implementação

**Fase 1 — Fundação (Centro de Configuração)**
- Tabela de configuração por empresa: ramo, rótulos, módulos ligados.
- Tela nova em Configurações: três abas — Vocabulário, Módulos, Ramo.
- Função de leitura de rótulo usada pelas telas (com padrão quando não configurado).
- Aplicação inicial do rótulo em Cascos (menu, títulos, seletores).

**Fase 2 — Módulos por empresa**
- Menu lateral passa a ler os módulos ligados, respeitando a precedência do servidor DMN.
- Bloqueio de rota para módulo desligado.
- Aviso de pendências antes de desligar.

**Fase 3 — Catálogos editáveis**
- Telas de cadastro para: riscos, EPIs, exames, cursos/treinamentos, temas de DDS, tipos de local.
- Marcar ativo/inativo, ordenar, buscar; nada de exclusão quando há vínculo.

**Fase 4 — Pacotes de ramo**
- Pacotes prontos (estaleiro, transporte, indústria, comércio, escola, saúde, construção).
- Botão "aplicar pacote" idempotente, com prévia e relatório do que será criado.

**Fase 5 — Identidade e documentos**
- Logo, razão social, CNAE, cabeçalho/rodapé dos PDFs por empresa (resolve também as pendências do PPP).
- Campos de assinatura do profissional habilitado preenchidos por cadastro, não fixos.

## Detalhes técnicos

- Nova tabela `empresa_config` (uma linha por empresa) com colunas jsonb `rotulos` e `modulos`, mais `ramo`, com GRANTs e RLS (leitura para autenticado, escrita só admin).
- Catálogos: tabelas por domínio já existentes recebem `empresa_id` nulo = global; novas linhas com `empresa_id` preenchido = personalização da empresa.
- `src/lib/labels.ts`: hook `useRotulo("casco")` com fallback para o texto padrão; nenhum texto novo hardcoded nas telas.
- `src/components/app-sidebar.tsx` e `src/lib/menu-catalog.ts` passam a filtrar por módulos ligados; `IS_BACKEND_LOCAL === true` curto-circuita e mostra tudo.
- Toda gravação no Centro de Configuração grava em `audit_logs`.
- Migrações novas apenas aditivas, em `supabase/migrations/`, aplicadas pelo `migrate-safe.sh`. Nenhum DELETE/DROP.

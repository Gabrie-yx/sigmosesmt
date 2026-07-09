# Roadmap Hub de Catálogos SST

Combinando sua sugestão + os pontos que você validou. Ordem pensada pra entregar valor rápido e deixar as automações (que dependem de fontes externas) pro final.

## Ordem de execução

### 🥇 Fase 1 — EPIs (rápido, tira "EM BREVE")
- Criar rota `/app/sesmt/catalogos/epis` reaproveitando `epi_catalog` que já existe
- Listagem + busca por CA/nome + filtros por status/validade
- CRUD básico (adicionar/editar/desativar CA)
- Remover flag "EM BREVE" do card no Hub
- Add ao submenu do sidebar

### 🥈 Fase 2 — Visão Geral no submenu (5 min)
- Adicionar item **"Visão Geral"** como PRIMEIRO sub-item de "Hub de Catálogos SST" no sidebar
- Aponta pra `/app/sesmt/catalogos` (a página com os cards grandes)
- Resolve o "órfão" que você apontou

### 🥉 Fase 3 — Auditoria dos Catálogos (governança)
- Trigger genérico de auditoria (`audit_catalogo_trigger`) gravando em `audit_logs` (tabela já existe)
- Aplicar em: `catalogo_riscos`, `catalogo_nrs`, `exam_catalog`, `catalogo_gases_atmosfericos`, `epi_catalog`, futuro `vacina_catalog`
- Campos capturados: quem, quando, ação (INSERT/UPDATE/DELETE), tabela, ID do registro, diff antes/depois
- Aba **"Histórico"** dentro de cada catálogo (opcional nessa fase — só o log já resolve compliance)

### 🏅 Fase 4 — Vacinas Ocupacionais
- Criar tabela `vacina_catalog` (nome, fabricante, doses, intervalo, via, indicações, contraindicações, PNI/privada, código eSocial se aplicável)
- **Seed do PNI 2026** — dados públicos do Ministério da Saúde, hardcoded no migration (não dá pra "scraper" em runtime; a lista é estável e pequena): Hepatite B, dT (Difteria/Tétano), Febre Amarela, Tríplice Viral, Influenza, COVID-19, Meningocócica ACWY, Hepatite A
- Rota `/app/sesmt/catalogos/vacinas` + CRUD
- Remover flag "EM BREVE"

### 🎖️ Fase 5 — Validar Cruzamentos dos 16 riscos novos
- Ler `risco_exames` e verificar quais dos 16 riscos novos (fumos de solda, sílica, CO, ozônio, névoas, poeira esmerilhamento, óleos, iluminação, sentado prolongado, pé prolongado, pressão psicológica, prensagem, corte por chapa, soterramento, colisão, fungos/mofo) já têm exames vinculados
- Migration com vínculos padrão baseados em NR-07 + PCMSO REV.05 DMN:
  - Fumos de solda → Espirometria, Rx tórax, hemograma
  - Sílica → Espirometria + Rx tórax semestral
  - CO / Ozônio → Espirometria + hemograma
  - Ruído (já existente) → Audiometria (verificar)
  - Ergonômicos → Avaliação clínica ocupacional
  - etc.
- Preencher `medidas_controle_padrao`, `epis_sugeridos`, `nrs_aplicaveis` onde estiverem vazios
- Testar visualmente na tela `/app/sesmt/catalogos/cruzamentos`

### 🏵️ Fase 6 — Automação "Importar do PGR"
- Botão no Hub e no Catálogo de Riscos: **"Importar riscos do PGR ativo"**
- Server function que lê `pgr_inventario_riscos` do PGR mais recente
- Diff contra `catalogo_riscos` (por `nome` + `categoria`)
- Modal mostra: "X riscos novos serão adicionados ao catálogo — revisar antes de confirmar"
- Segue a linha da memória `sigmo-resiliencia-sem-ia`: import é determinístico, sem depender de IA
- Prepara o terreno pra quando você importar PGR/PCMSO/LTCAT/LIP em massa

## Sobre "puxar da internet" (respostas honestas)

### Tabela 27 eSocial (exames)
❌ **Não tem API pública oficial do MTE/eSocial** com a Tabela 27 versionada. O que dá pra fazer:
- **CRUD manual na UI** — libera você/Israel a adicionar código novo quando o MTE publicar nota técnica
- **Baixar o PDF/XLSX oficial** de <https://www.gov.br/esocial/pt-br/documentacao-tecnica> e importar via upload (parser XLSX)
- **Alerta manual** quando MTE publicar nova versão (semestral geralmente)
- Recomendo: **CRUD + botão "Importar planilha oficial"** — não fica dependente de scraper que quebra

### Vacinas (PNI Ministério da Saúde)
❌ **Também não tem API estável**. O PNI muda 1x/ano em média. Seed hardcoded no migration é mais confiável que scraper — se mudar, novo migration.

### Riscos (catálogo)
❌ **Não existe "catálogo oficial" central de riscos no Brasil**. Cada empresa monta o seu com base em NR-09, NHO Fundacentro, ACGIH. O nosso catálogo customizado + import do PGR é o caminho certo.

## Ordem final proposta

```text
Fase 1 (EPIs)         → 1 sessão de trabalho
Fase 2 (Visão Geral)  → 5 min, junto com Fase 1
Fase 3 (Auditoria)    → 1 migration + trigger genérico
Fase 4 (Vacinas)      → 1 migration + seed + rota
Fase 5 (Cruzamentos)  → 1 migration de vínculos + validação
Fase 6 (Import PGR)   → 1 server function + botão + modal
```

## Confirmação

Se topar essa ordem, começo pela **Fase 1 (EPIs)** e **Fase 2 (Visão Geral)** juntas nessa próxima leva. As fases 3-6 vou entregando uma por vez pra você validar cada uma sem virar bolo indigesto.

**Alternativa:** se preferir atacar por prioridade de compliance (auditoria primeiro, por causa da LGPD/NR-01), inverto pra Fase 3 → 1 → 2 → 4 → 5 → 6. Você decide. 😄

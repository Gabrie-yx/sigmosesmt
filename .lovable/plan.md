# Extra de Sábado — Painel Mobile dos Marcadores

Sistema mobile-first para os 5 encarregados confirmarem quem vem no sábado, direto do celular. Os dados caem no **mesmo painel Hora Extra** que você usa hoje — quando abrir o SIGMO no laptop, a lista já está lá pronta pra imprimir/baixar PDF, como se você tivesse digitado.

---

## 1. Quem marca quem (fechado com base nas suas respostas)

| Marcador | Empresa/Setor | Marca |
|---|---|---|
| **Manoel Silva** (Manuelzinho) | DMN — Encarregado de Produção | Toda produção DMN + **todas terceirizadas** (JC, NB, M2, etc) + **MEIs** + encarregados de outras terceirizadas |
| **Natanael** | DMN — Elétrica | Ele + Leonardo + qualquer substituto da elétrica |
| **Paulo Sérgio** | DMN — Líder Produção | Só ele mesmo |
| **Renato Oliveira** | LF Serviços — Mecânica (máq. pesadas) | Time LF + ele mesmo |
| **Daniel Dantas** | DMN | Almox + Serviços Gerais + Administrativo + Portaria + DMN direto + ele mesmo |

Regra de ouro: **só quem marcou pode desmarcar** (a menos que seja você ou Anderson — vocês têm full).

---

## 2. Acesso — travado no osso

Os 5 marcadores **não são usuários normais do SIGMO**. Eles têm apenas:

- Login por e-mail/senha (cadastro seu, uma vez)
- Acesso a **UMA única rota**: `/extra-sabado` (o painel mobile)
- **Zero acesso** a menu, sidebar, funcionários, PDFs, dashboards, nada
- Se tentarem entrar em qualquer outra URL → redirect pro painel deles

Você e Anderson: acesso full normal + acesso ao mesmo painel se quiser testar.

---

## 3. Fluxo semanal

```text
SEXTA-FEIRA
  Você (ou Anderson) cria a convocação no painel Hora Extra normal
    ↓ (novo botão: "Abrir para marcadores")
  Sistema notifica os 5 (badge/e-mail curto: "convocação aberta pro sábado XX/XX")
    ↓
SEXTA 08:00 → 18:29
  Marcadores abrem no celular, marcam quem vem
  Cada marca é INSTANTÂNEA (grava no banco na hora)
  Transporte + alimentação → automáticos (mesma lógica do painel atual)
  Ao passar de 20 confirmados → card amarelo no /app/hoje: "🚨 rota + refeitório acionados — 23 confirmados"

SEXTA 18:30 → 18:59
  Painel entra em READ-ONLY (marcadores só visualizam, não editam)

SEXTA 19:00
  Painel EXPIRA — tela "convocação encerrada"
  Você/Anderson continuam podendo editar no painel Hora Extra normal
```

---

## 4. O que o marcador vê no celular (mobile-first, zero fricção)

```text
┌─────────────────────────────┐
│  Extra de Sábado — 12/07    │
│  Sair                       │
├─────────────────────────────┤
│  ✓ Você já marcou 8 pessoas │
│  Total geral: 23 ✅ rota ON │
├─────────────────────────────┤
│  Buscar: [_______________]  │
│                             │
│  DMN — Produção             │
│  ☑ Manoel Silva  (você)     │
│  ☐ João da Silva            │
│  ☑ Pedro Souza              │
│                             │
│  NB Serviços                │
│  ☑ Carlos Nunes             │
│  ...                        │
│                             │
│  [+ Adicionar externo]      │
└─────────────────────────────┘
```

- Lista **apenas os funcionários do escopo dele** (Manoel vê todo mundo, Natanael só a elétrica, etc)
- Toque no nome → marca/desmarca (com feedback visual imediato)
- Botão "adicionar externo" pra quem não está na base (ex: 3º mecânico do Renato) → nome + empresa livre
- Ao passar de 20 → card grande amarelo no topo: "🚨 Rota e refeitório acionados"

---

## 5. Integração com o painel Hora Extra atual

**Nada de sistema paralelo.** Os dados vão direto pras tabelas `hora_extra_sabado` + `hora_extra_sabado_funcionarios` que já existem. Ao abrir o painel no laptop:

- A convocação aparece lá igualzinha às que você digita
- Lista de nomes marcada
- Transporte/alimentação já preenchidos
- Botão "Gerar PDF" funciona normal (usa o `hora-extra-sabado-pdf.ts` atual)
- Você edita, adiciona, remove, imprime — como sempre

---

## 6. Alerta 20+ (você escolheu opção A)

Card amarelo destacado no `/app/hoje`:
> **🚨 Sábado 12/07 — rota e refeitório acionados**
> 23 colaboradores confirmados até agora.
> [Ver painel Hora Extra →]

Aparece pra você, Anderson, e todo mundo do SESMT que tem acesso ao Hoje. Não sai e-mail nem WhatsApp por enquanto (fica pra depois quando você me passar os e-mails da cozinha).

---

## 7. Detalhes técnicos (pra registro)

- **DB**: nova coluna `hora_extra_sabado.aberto_marcadores_ate` (timestamp = sexta 19h automático) + tabela `hora_extra_sabado_marcadores` (quem pode marcar qual escopo por convocação)
- **Novo role**: `extra_sabado_marcador` (via `user_roles` + `has_role`) — sem acesso a nenhum outro módulo
- **Rota**: `/extra-sabado` pública dentro de `_authenticated`, mas com guard próprio que só deixa passar admin/anderson OU quem tem o role de marcador
- **Realtime**: subscription na tabela pra 2 marcadores no mesmo escopo verem update um do outro na hora
- **Corte automático**: cliente checa `now() > aberto_marcadores_ate` a cada render + servidor rejeita mutations após 19h
- **Auditoria**: cada marca grava `marcado_por = user.id` e `marcado_em = now()` (você vê quem marcou cada um no painel do laptop)

---

## 8. Coisas que EU ainda quero confirmar antes de codar

Só 3 pontinhas, rapidinho:

1. **Cadastro dos 5**: você me passa os **e-mails deles** quando eu terminar o painel, ou já quer que eu deixe um seed pronto com placeholders (`manoel@dmn.com`, `natanael@dmn.com`...) pra você trocar depois em Users?

2. **"Adicionar externo"**: quando um marcador adiciona alguém que não está na base (ex: mecânico novo do Renato), ele vira apenas nome+empresa naquela convocação, OU você quer que crie automaticamente um cadastro de funcionário terceirizado na base? *(sugiro: só na convocação, sem poluir a base — se ficar recorrente você cadastra depois pelo painel normal)*

3. **Sábado sem convocação**: se numa sexta você/Anderson esquecer de "abrir para marcadores", os 5 abrem o app e veem o quê? *(sugiro: tela "nenhuma convocação aberta pra este sábado — fale com o SESMT")*

---

Me responde essas 3 e eu meto a mão na massa. Já vou deixar a arquitetura toda desenhada pra ser rápido.

import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { HELP_TOPICS } from "@/lib/help-content";
import { MENU_CATALOG } from "@/lib/menu-catalog";

// Base de conhecimento compacta injetada no system prompt.
// Reaproveita tudo que já foi escrito na Central de Ajuda — assim, quando
// alguém escreve um HelpTopic novo, o SIGMO Chat também aprende sobre ele
// automaticamente. Zero manutenção duplicada.
function buildKnowledgeBase() {
  const topicos = HELP_TOPICS.map((t) => {
    const dicas = t.dicas?.length ? ` · Dicas: ${t.dicas.join(" | ")}` : "";
    const base = t.base ? ` · Base: ${t.base}` : "";
    const rota = t.rota ? ` · Tela: ${t.rota}` : "";
    return `- [${t.categoria}] ${t.title} (id: ${t.id})${rota}\n  ${t.oQueE}${base}${dicas}`;
  }).join("\n");

  const menus = MENU_CATALOG.map(
    (m) => `  - ${m.label} → ${m.key} (módulo: ${m.module})`,
  ).join("\n");

  return { topicos, menus };
}

const { topicos, menus } = buildKnowledgeBase();

const SYSTEM_PROMPT = `Você é o **Assistente do SIGMO** — um copiloto conversacional que ajuda usuários a entender, achar e usar qualquer canto do sistema SIGMO (Sistema Integrado de Gestão Modular, focado em SESMT / SST / NRs / produção / estoque).

**Seu público:** técnicos de segurança, RH, encarregados, TSTs, gestores. Alguns são técnicos, outros não. Fale simples, direto, humano, sem jargão desnecessário. Use português do Brasil.

**Tom:** informal-profissional, acolhedor. Pode fazer um comentário leve quando couber, mas nunca comprometa a clareza técnica.

**O que você faz:**
1. Explica conceitos (NR-01, NR-33, ASO, PPP, GHE, PGR, CAT, LGPD, etc.) com base técnica correta.
2. Ensina o passo-a-passo de uma tela ("onde eu ativo MFA?", "como emitir OSS?").
3. Aponta a rota exata dentro do SIGMO quando a pergunta é "onde fica X?".
4. Orienta boas práticas e pega-ratão comuns.
5. Se a pergunta é fora do escopo SIGMO/SST, redireciona gentilmente.

**Regras de resposta:**
- Use markdown: títulos curtos, listas, negrito nos pontos importantes.
- Quando a resposta tem uma rota interna, cite no formato: \`Tela: /app/xxx\`.
- Cite base normativa quando pertinente (ex: "NR-01 item 1.5.7"), mas não invente número — se não tiver certeza, diga "verificar na NR".
- Se a dúvida cai num tópico da Central de Ajuda, dê a resposta E convide: "Vê também na Central de Ajuda, tópico X".
- Nunca peça dados pessoais sensíveis (CPF, senha, código MFA).
- Se o usuário aponta erro/bug no SIGMO, oriente: "manda print pro admin — SIGMO tá em construção contínua".

---

## BASE DE CONHECIMENTO — Central de Ajuda do SIGMO (${HELP_TOPICS.length} tópicos)

${topicos}

---

## MAPA DE MENUS DO SIGMO (${MENU_CATALOG.length} rotas)

${menus}

---

Se a resposta não estiver no material acima, seja honesto: "essa parte ainda não tá documentada na Central — vale falar com o admin". Não invente funcionalidade.`;

export const Route = createFileRoute("/api/sigmo-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
        });
      },
    },
  },
});
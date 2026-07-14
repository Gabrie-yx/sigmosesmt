import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "inspecoes-fotos";

const InputSchema = z.object({
  inspecao_id: z.string().uuid(),
  contexto: z.string().optional().nullable(),
});

export type NcSugerida = {
  foto_id: string | null;
  nr_codigo: string;
  nr_item: string | null;
  descricao: string;
  recomendacao: string;
  probabilidade: number; // 1..5
  severidade: number; // 1..5
  classe_risco: "BAIXO" | "MODERADO" | "ALTO" | "CRITICO";
  risco_calculado: number;
  norma_titulo?: string | null;
};

const SUGESTAO_SCHEMA = {
  type: "object",
  properties: {
    ncs: {
      type: "array",
      description: "Lista de não conformidades detectadas nas fotos. Cada NC deve ser um achado específico e acionável, com base normativa clara. NÃO invente. Se não há NC visível, retorne lista vazia.",
      items: {
        type: "object",
        properties: {
          foto_indice: { type: "integer", description: "Índice (1-based) da foto onde a NC é visível. Use 0 se a NC vale para o conjunto." },
          nr_codigo: { type: "string", description: "Código da NR principal violada (ex: NR-11, NR-34, NR-06, NR-35)." },
          nr_item: { type: "string", description: "Item específico da NR (ex: 11.5.3, 34.11.3). Use string vazia se não souber com certeza." },
          descricao: { type: "string", description: "Descrição objetiva do achado: o QUE está errado e ONDE (10-40 palavras). Sem juízo de valor, factual." },
          recomendacao: { type: "string", description: "Ação corretiva imediata recomendada (10-30 palavras). Ex: 'isolar raio de manobra e designar sinaleiro NR-11'." },
          probabilidade: { type: "integer", minimum: 1, maximum: 5, description: "1=raro, 3=possível, 5=quase certo" },
          severidade: { type: "integer", minimum: 1, maximum: 5, description: "1=leve, 3=lesão com afastamento, 5=fatalidade/perda catastrófica" },
        },
        required: ["foto_indice", "nr_codigo", "descricao", "recomendacao", "probabilidade", "severidade"],
        additionalProperties: false,
      },
    },
    parecer: { type: "string", description: "Parecer geral do inspetor IA (2-4 frases) sobre a cena inspecionada." },
  },
  required: ["ncs", "parecer"],
  additionalProperties: false,
};

export const analisarFotosInspecao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ncs: NcSugerida[]; parecer: string; total_fotos: number }> => {
    const { supabase } = context as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada no servidor.");

    // 1) carrega fotos (só as físicas, ignora CFTV url-only)
    const { data: fotos, error: fErr } = await supabase
      .from("inspecao_fotos")
      .select("id, storage_path, fonte, legenda")
      .eq("inspecao_id", data.inspecao_id)
      .order("created_at");
    if (fErr) throw new Error(fErr.message);
    const fotosFisicas = (fotos ?? []).filter((f: any) => f.fonte !== "cftv" || !String(f.storage_path).startsWith("cftv://"));
    if (!fotosFisicas.length) throw new Error("Anexe ao menos uma foto antes de rodar a análise por IA.");
    if (fotosFisicas.length > 10) throw new Error("Máximo 10 fotos por análise. Rode em lotes.");

    // 2) gera signed URLs (Gemini via gateway busca direto — evita download+base64 no Worker)
    const signedUrls: string[] = [];
    for (const f of fotosFisicas) {
      const { data: signed, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(f.storage_path, 60 * 15);
      if (error || !signed?.signedUrl) throw new Error(`Falha ao assinar foto ${f.id}: ${error?.message ?? "desconhecido"}`);
      signedUrls.push(signed.signedUrl);
    }

    const ctxTexto = data.contexto?.trim() ? `\n\nContexto da inspeção informado pelo TST:\n${data.contexto.trim()}\n` : "";

    const userContent: any[] = [
      {
        type: "text",
        text:
          `Você é um TST sênior especialista em NRs brasileiras (NR-06, NR-11, NR-33, NR-34, NR-35, NR-12, NR-18, NR-23) inspecionando fotos de campo.\n\n` +
          `Foram enviadas ${fotosFisicas.length} foto(s), numeradas de 1 a ${fotosFisicas.length} na ordem em que aparecem abaixo.` +
          ctxTexto +
          `\n\nSua tarefa:\n` +
          `1. Analise CADA foto procurando NÃO CONFORMIDADES REAIS visíveis (EPI ausente, trabalhador sob carga, guia manual de carga suspensa, mangueira no piso, ausência de sinaleiro/rigger, sinalização, isolamento, calços, etc.).\n` +
          `2. Para cada NC, indique a foto (foto_indice 1..${fotosFisicas.length}), a NR e item violados, uma descrição factual, a ação corretiva e o P×S (1-5 cada).\n` +
          `3. NÃO invente. Se a foto não mostra NC clara, não gere NC pra ela. Prefira menos NCs bem fundamentadas a muitas fracas.\n` +
          `4. Descrição em português técnico de TST, sem juízo de valor.\n` +
          `5. Responda APENAS via tool 'registrar_ncs'.`,
      },
      ...signedUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um TST sênior brasileiro. Rigoroso, factual, cita NR e item. Não inventa." },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "registrar_ncs",
            description: "Registra as NCs identificadas nas fotos da inspeção.",
            parameters: SUGESTAO_SCHEMA,
          },
        }],
        tool_choice: { type: "function", function: { name: "registrar_ncs" } },
      }),
      });
    } catch (e: any) {
      clearTimeout(timeout);
      if (e?.name === "AbortError") throw new Error("A análise por IA demorou demais (>90s). Tente com menos fotos ou refaça.");
      throw new Error(`Falha de rede ao chamar IA: ${e?.message ?? e}`);
    }
    clearTimeout(timeout);

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) throw new Error("Limite de requisições à IA atingido. Tente novamente em alguns instantes.");
      if (aiResp.status === 402) throw new Error("Créditos de IA esgotados. Recarregue em Configurações → Planos & créditos.");
      throw new Error(`Falha na IA (${aiResp.status}): ${txt.slice(0, 200)}`);
    }
    const json = await aiResp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("IA não retornou sugestões estruturadas. Tente novamente ou envie fotos com mais nitidez.");
    let parsed: any;
    try { parsed = JSON.parse(call.function.arguments); }
    catch { throw new Error("Resposta da IA em formato inválido."); }

    const brutas = Array.isArray(parsed.ncs) ? parsed.ncs : [];
    const ncs: NcSugerida[] = brutas.map((nc: any) => {
      const idx = Number.isInteger(nc.foto_indice) ? nc.foto_indice : 0;
      const foto = idx >= 1 && idx <= fotosFisicas.length ? fotosFisicas[idx - 1] : null;
      const p = Math.max(1, Math.min(5, Number(nc.probabilidade) || 3));
      const s = Math.max(1, Math.min(5, Number(nc.severidade) || 3));
      const r = p * s;
      const classe: NcSugerida["classe_risco"] =
        r >= 15 ? "CRITICO" : r >= 8 ? "ALTO" : r >= 4 ? "MODERADO" : "BAIXO";
      return {
        foto_id: foto?.id ?? null,
        nr_codigo: String(nc.nr_codigo ?? "").trim() || "NR-01",
        nr_item: String(nc.nr_item ?? "").trim() || null,
        descricao: String(nc.descricao ?? "").trim(),
        recomendacao: String(nc.recomendacao ?? "").trim(),
        probabilidade: p,
        severidade: s,
        classe_risco: classe,
        risco_calculado: r,
      };
    }).filter((n: NcSugerida) => n.descricao.length > 0);

    return { ncs, parecer: String(parsed.parecer ?? "").trim(), total_fotos: fotosFisicas.length };
  });
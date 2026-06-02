import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  riscoId: z.string().uuid(),
});

export type SugestaoIA = {
  epi_id: string;
  nome_material: string;
  obrigatorio: boolean;
  motivo: string;
};

export const sugerirEpisIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabase } = context as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY não configurada", sugestoes: [] as SugestaoIA[] };
    }

    const { data: risco, error: rErr } = await supabase
      .from("pgr_inventario_riscos")
      .select("id, categoria, perigo, agravo, fonte_geradora, controles_existentes, intensidade, unidade, limite_tolerancia")
      .eq("id", data.riscoId)
      .maybeSingle();
    if (rErr || !risco) {
      return { error: "Risco não encontrado", sugestoes: [] as SugestaoIA[] };
    }

    const { data: estoque, error: eErr } = await supabase
      .from("estoque_epi")
      .select("id, nome_material, codigo_material, ca, quantidade_atual")
      .order("nome_material");
    if (eErr) {
      return { error: eErr.message, sugestoes: [] as SugestaoIA[] };
    }

    const { data: jaVinc } = await supabase
      .from("pgr_risco_epi")
      .select("epi_id")
      .eq("inventario_id", data.riscoId);
    const jaVincSet = new Set((jaVinc ?? []).map((v: { epi_id: string }) => v.epi_id));
    const disponiveis = (estoque ?? []).filter((e: { id: string }) => !jaVincSet.has(e.id));

    if (disponiveis.length === 0) {
      return { error: "Todos os EPIs do estoque já estão vinculados a este risco.", sugestoes: [] as SugestaoIA[] };
    }

    const userMsg = `Risco do PGR:
- Categoria: ${risco.categoria}
- Perigo: ${risco.perigo}
- Agravo: ${risco.agravo ?? "—"}
- Fonte geradora: ${risco.fonte_geradora ?? "—"}
- Controles existentes: ${risco.controles_existentes ?? "—"}
- Intensidade medida: ${risco.intensidade ?? "—"} ${risco.unidade ?? ""}
- Limite de tolerância (NR-15): ${risco.limite_tolerancia ?? "—"} ${risco.unidade ?? ""}

Estoque de EPIs disponíveis (id | nome | CA):
${disponiveis.map((e: { id: string; nome_material: string; ca: string | null }) => `${e.id} | ${e.nome_material} | CA ${e.ca ?? "—"}`).join("\n")}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em SST brasileiro (NRs 6, 9, 10, 15, 16, 32, 33, 35). Dada a descrição de um risco do PGR e o estoque de EPIs disponíveis, selecione APENAS os EPIs do estoque que efetivamente protegem contra esse risco. Marque obrigatório=true quando o EPI for indispensável conforme NR aplicável; recomendado (obrigatorio=false) quando for complementar. Justifique cada escolha em uma frase curta. Nunca invente EPIs fora do estoque.",
          },
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_sugestoes_epi",
              description: "Registra os EPIs sugeridos para o risco.",
              parameters: {
                type: "object",
                properties: {
                  sugestoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        epi_id: { type: "string", description: "UUID do EPI exatamente como veio na lista de estoque" },
                        obrigatorio: { type: "boolean" },
                        motivo: { type: "string", description: "Justificativa curta (até 100 caracteres) citando a NR quando aplicável." },
                      },
                      required: ["epi_id", "obrigatorio", "motivo"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sugestoes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_sugestoes_epi" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return { error: "Limite de IA atingido. Aguarde 1 minuto.", sugestoes: [] as SugestaoIA[] };
      if (aiResp.status === 402) return { error: "Créditos de IA esgotados.", sugestoes: [] as SugestaoIA[] };
      const txt = await aiResp.text().catch(() => "");
      return { error: `Erro IA (${aiResp.status}): ${txt.slice(0, 120)}`, sugestoes: [] as SugestaoIA[] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiJson: any = await aiResp.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let raw: Array<{ epi_id: string; obrigatorio: boolean; motivo: string }> = [];
    try {
      const parsed = args ? JSON.parse(args) : {};
      raw = Array.isArray(parsed.sugestoes) ? parsed.sugestoes : [];
    } catch {
      return { error: "Resposta da IA inválida", sugestoes: [] as SugestaoIA[] };
    }

    const byId = new Map(disponiveis.map((e: { id: string; nome_material: string }) => [e.id, e.nome_material]));
    const sugestoes: SugestaoIA[] = raw
      .filter((s) => byId.has(s.epi_id))
      .map((s) => ({
        epi_id: s.epi_id,
        nome_material: byId.get(s.epi_id) as string,
        obrigatorio: !!s.obrigatorio,
        motivo: String(s.motivo ?? "").slice(0, 200),
      }));

    return { error: null as string | null, sugestoes };
  });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  trainingId: z.string().uuid(),
  anexoPath: z.string().min(1).max(1024),
});

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSim(a: string, b: string): number {
  const A = new Set(normalize(a).split(" ").filter((t) => t.length >= 2));
  const B = new Set(normalize(b).split(" ").filter((t) => t.length >= 2));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / Math.max(A.size, B.size);
}

function mimeFromPath(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export const extrairParticipantesDaLista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY não configurada", detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
    }

    // 1) Baixa o arquivo do storage
    const dl = await supabase.storage.from("training-docs").download(data.anexoPath);
    if (dl.error || !dl.data) {
      return { error: `Falha ao baixar arquivo: ${dl.error?.message ?? "desconhecido"}`, detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
    }
    const blob = dl.data;
    if (blob.size > 20 * 1024 * 1024) {
      return { error: "Arquivo muito grande (>20MB). Reduza a resolução.", detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const b64 = buf.toString("base64");
    const mime = mimeFromPath(data.anexoPath);

    // 2) Chama Lovable AI Gateway com tool calling
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você analisa listas de presença de treinamentos de SST. Extraia TODOS os nomes de participantes visíveis. Considere alguém como presente apenas se houver assinatura ao lado do nome. Retorne apenas dados que conseguir ler com confiança.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os participantes desta lista de presença." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_participantes",
              description: "Registra os participantes detectados na lista de presença.",
              parameters: {
                type: "object",
                properties: {
                  participantes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string", description: "Nome completo como aparece na lista" },
                        assinou: { type: "boolean", description: "true se há assinatura visível na linha" },
                        matricula: { type: "string", description: "Matrícula/registro se visível" },
                        cargo: { type: "string", description: "Cargo/função se visível" },
                        empresa: { type: "string", description: "Empresa se visível" },
                      },
                      required: ["nome", "assinou"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["participantes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_participantes" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text().catch(() => "");
      console.error("[cursos-ocr] AI gateway error", aiResp.status, text);
      if (aiResp.status === 429) {
        return { error: "Limite de requisições atingido. Aguarde 1 minuto e tente novamente.", detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
      }
      if (aiResp.status === 402) {
        return { error: "Créditos de IA esgotados. Adicione créditos no workspace Lovable.", detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
      }
      return { error: `Erro na IA (${aiResp.status}). Verifique a imagem.`, detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
    }

    const aiJson: any = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let detectados: Array<{ nome: string; assinou: boolean; matricula?: string; cargo?: string; empresa?: string }> = [];
    try {
      const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
      detectados = Array.isArray(args?.participantes) ? args.participantes : [];
    } catch (e) {
      console.error("[cursos-ocr] failed to parse tool args", e);
    }

    if (detectados.length === 0) {
      return { error: "Nenhum participante detectado. Verifique se a imagem está legível.", detectados: [], matchExato: [], matchAproximado: [], naoEncontrados: [] };
    }

    // 3) Carrega funcionários ATIVOS e tenta match
    const { data: emps, error: empErr } = await supabase
      .from("employees")
      .select("id, nome, matricula, cpf, company_id, status, setor")
      .eq("status", "ATIVO");
    if (empErr) {
      return { error: `Erro ao buscar funcionários: ${empErr.message}`, detectados, matchExato: [], matchAproximado: [], naoEncontrados: [] };
    }

    // Excluir quem já está na turma
    const { data: jaInscritos } = await supabase
      .from("training_attendees")
      .select("employee_id")
      .eq("training_id", data.trainingId);
    const jaSet = new Set((jaInscritos ?? []).map((a: any) => a.employee_id));

    type Match = {
      detectado: { nome: string; assinou: boolean; matricula?: string };
      employee_id: string;
      nome_base: string;
      score: number;
      ja_inscrito: boolean;
    };
    const matchExato: Match[] = [];
    const matchAproximado: Match[] = [];
    const naoEncontrados: Array<{ nome: string; assinou: boolean }> = [];

    for (const d of detectados) {
      let best: { emp: any; score: number } | null = null;
      const nomeDetNorm = normalize(d.nome);
      const matDet = (d.matricula ?? "").replace(/\D/g, "");
      for (const e of emps ?? []) {
        // Match exato por matrícula
        if (matDet && e.matricula && e.matricula.replace(/\D/g, "") === matDet) {
          best = { emp: e, score: 1.0 };
          break;
        }
        const empNorm = normalize(e.nome);
        if (empNorm === nomeDetNorm) {
          best = { emp: e, score: 1.0 };
          break;
        }
        const sim = tokenSim(d.nome, e.nome);
        if (!best || sim > best.score) best = { emp: e, score: sim };
      }

      if (best && best.score >= 0.99) {
        matchExato.push({
          detectado: { nome: d.nome, assinou: d.assinou, matricula: d.matricula },
          employee_id: best.emp.id,
          nome_base: best.emp.nome,
          score: best.score,
          ja_inscrito: jaSet.has(best.emp.id),
        });
      } else if (best && best.score >= 0.55) {
        matchAproximado.push({
          detectado: { nome: d.nome, assinou: d.assinou, matricula: d.matricula },
          employee_id: best.emp.id,
          nome_base: best.emp.nome,
          score: best.score,
          ja_inscrito: jaSet.has(best.emp.id),
        });
      } else {
        naoEncontrados.push({ nome: d.nome, assinou: d.assinou });
      }
    }

    return { error: null as string | null, detectados, matchExato, matchAproximado, naoEncontrados };
  });
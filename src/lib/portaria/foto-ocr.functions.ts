// OCR/validação semântica das fotos da portaria via Lovable AI Gateway.
// - "rosto"     : precisa ter UM rosto humano nítido em primeiro plano (selfie/retrato).
// - "documento" : precisa parecer RG, CNH, CPF impresso ou similar (estrutura de
//                 documento oficial com foto/campos/número). Bloqueia qualquer
//                 imagem aleatória (mesa, chão, tela de celular, meme, etc.).
//
// Também exporta `deletePortariaVisita` — apenas admin — pra apagar visitas
// de teste (cascata em acompanhantes; veículo/pessoa ficam se estiverem em uso).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ValidateSchema = z.object({
  fileBase64: z.string().min(100),
  mime: z.string().min(3).max(64),
  tipo: z.enum(["rosto", "documento"]),
});

export type ValidateFotoResult = {
  ok: boolean;
  motivo?: string;
  confianca?: number; // 0..1
};

export const validatePortariaFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ValidateSchema.parse(d))
  .handler(async ({ data }): Promise<ValidateFotoResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: true, motivo: "OCR indisponível (sem API key) — foto aceita sem validação." };
    if (!data.mime.startsWith("image/")) {
      return { ok: false, motivo: "Envie uma imagem (JPG/PNG). Vídeo/PDF não é aceito aqui." };
    }

    const systemPrompt = data.tipo === "rosto"
      ? `Você valida uma foto de PORTARIA de uma indústria. A foto DEVE ser um RETRATO/SELFIE de UMA pessoa: rosto humano nítido em primeiro plano, olhos visíveis, enquadrado ao menos do peito pra cima.
RECUSE se: nenhum rosto detectável, rosto muito distante/pequeno, várias pessoas amontoadas, foto de tela de celular, foto de foto, chão, veículo, documento, meme, animal, screenshot, prédio, EPI sem pessoa.
ACEITE se: um rosto humano real ocupa área central significativa, mesmo com capacete/uniforme/máscara — desde que o rosto ainda esteja identificável.
Devolva JSON: {"ok":true|false,"motivo":"...","confianca":0..1}. Sem markdown.`
      : `Você valida uma foto de PORTARIA de uma indústria. A foto DEVE ser um DOCUMENTO OFICIAL brasileiro com foto: RG (Carteira de Identidade), CNH, CPF impresso, CTPS, Passaporte, RNE/CRNM. Aceita frente ou verso desde que dê pra reconhecer a estrutura (campos impressos, número, foto ou brasão).
RECUSE se: foto de rosto/selfie, cartão de crédito, boleto, celular na mão, tela de app, comprovante, print, folha em branco, contrato genérico, veículo, meme, qualquer coisa que não seja documento de identificação com foto.
ACEITE se: dá pra ver a estrutura de um documento oficial de identificação, mesmo com brilho/tremor moderado, desde que os campos e a foto estejam reconhecíveis.
Devolva JSON: {"ok":true|false,"motivo":"...","confianca":0..1}. Sem markdown.`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: `Valide a imagem anexa como "${data.tipo}".` },
                { type: "image_url", image_url: { url: `data:${data.mime};base64,${data.fileBase64}` } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!resp.ok) {
        // Se o gateway falhar, NÃO bloqueia o porteiro — só loga e passa.
        return { ok: true, motivo: `Validação IA indisponível (${resp.status}) — foto aceita.` };
      }
      const json = await resp.json();
      const raw = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return {
        ok: !!parsed.ok,
        motivo: typeof parsed.motivo === "string" ? parsed.motivo : undefined,
        confianca: typeof parsed.confianca === "number" ? parsed.confianca : undefined,
      };
    } catch (e: any) {
      return { ok: true, motivo: `Validação IA indisponível (${e?.message ?? "erro"}) — foto aceita.` };
    }
  });

// ─── Delete admin ─────────────────────────────────────────────────────────────

const DeleteVisitaSchema = z.object({
  visitaId: z.string().uuid(),
});

export const deletePortariaVisita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteVisitaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só admin apaga visitas.
    const { data: isAdmin, error: rolErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (rolErr) throw new Error("Falha ao validar permissão.");
    if (!isAdmin) throw new Error("Só administradores podem excluir visitas.");

    // Apaga acompanhantes primeiro; depois a visita.
    await supabaseAdmin.from("portaria_visita_acompanhantes").delete().eq("visita_id", data.visitaId);
    const { error } = await supabaseAdmin.from("portaria_visitas").delete().eq("id", data.visitaId);
    if (error) throw new Error(`Erro ao excluir visita: ${error.message}`);

    return { ok: true };
  });
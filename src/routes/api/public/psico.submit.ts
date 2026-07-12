import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

const SubmitSchema = z.object({
  token: z.string().min(8).max(128),
  consentimento: z.literal(true),
  versao_termo: z.string().max(32).default("v1.2026-07"),
  faixa_etaria: z.string().max(16).nullable().optional(),
  faixa_tempo_casa: z.string().max(16).nullable().optional(),
  respostas: z
    .array(
      z.object({
        item_codigo: z.string().min(1).max(32),
        dimensao: z.string().min(1).max(32),
        valor: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(100),
});

// POST /api/public/psico/submit — colaborador envia respostas anônimas.
// Chave: NADA aqui identifica o respondente (sem user_id, sem cookie, sem IP em claro).
export const Route = createFileRoute("/api/public/psico/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload;
        try {
          payload = SubmitSchema.parse(await request.json());
        } catch (e) {
          return Response.json({ ok: false, error: "payload_invalido" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const hash = sha256(payload.token);

        // 1) valida token single-use
        const { data: tok, error: tokErr } = await supabaseAdmin
          .from("psico_tokens")
          .select("id, campanha_id, ghe_id, usado_em, expira_em")
          .eq("token_hash", hash)
          .maybeSingle();
        if (tokErr) return Response.json({ ok: false, error: "db" }, { status: 500 });
        if (!tok) return Response.json({ ok: false, error: "TOKEN_INVALIDO" }, { status: 404 });
        if (tok.usado_em) return Response.json({ ok: false, error: "TOKEN_JA_USADO" }, { status: 410 });
        if (new Date(tok.expira_em).getTime() < Date.now())
          return Response.json({ ok: false, error: "TOKEN_EXPIRADO" }, { status: 410 });

        // 2) hash de IP/UA (apenas indício de origem, não reversível)
        const ipHash = sha256(
          (request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for") ??
            "0.0.0.0") + ":sigmo-psico",
        );
        const uaHash = sha256((request.headers.get("user-agent") ?? "") + ":sigmo-psico");

        // 3) registra consentimento (separado das respostas)
        await supabaseAdmin.from("psico_consentimentos").insert({
          campanha_id: tok.campanha_id,
          token_hash: hash,
          versao_termo: payload.versao_termo,
          ip_hash: ipHash,
          ua_hash: uaHash,
        });

        // 4) grava respostas SEM user_id
        const rows = payload.respostas.map((r) => ({
          campanha_id: tok.campanha_id,
          ghe_id: tok.ghe_id,
          dimensao: r.dimensao,
          item_codigo: r.item_codigo,
          valor: r.valor,
          faixa_etaria: payload.faixa_etaria ?? null,
          faixa_tempo_casa: payload.faixa_tempo_casa ?? null,
        }));

        const { error: insErr } = await supabaseAdmin.from("psico_respostas").insert(rows);
        if (insErr) {
          console.error("[psico.submit] insert respostas", insErr);
          return Response.json({ ok: false, error: "db" }, { status: 500 });
        }

        // 5) invalida token (single-use)
        await supabaseAdmin
          .from("psico_tokens")
          .update({ usado_em: new Date().toISOString() })
          .eq("id", tok.id);

        return Response.json({ ok: true });
      },
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

/**
 * Canal público anônimo de denúncia (Lei 14.457/2022 — Emprega + Mulher).
 * Sem autenticação, sem cookie, sem token exigido. Identificação é OPCIONAL.
 * IP/UA armazenados apenas em hash (não reversível).
 */

const Schema = z.object({
  company_id: z.string().uuid().nullable().optional(),
  categoria: z.enum(["ASSEDIO_MORAL", "ASSEDIO_SEXUAL", "DISCRIMINACAO", "VIOLENCIA", "OUTRO"]),
  local_ocorrencia: z.string().max(200).optional(),
  data_aproximada: z.string().nullable().optional(),
  relato: z.string().min(20).max(5000),
  quer_retorno: z.boolean().default(false),
  contato_retorno: z.string().max(200).optional(),
});

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export const Route = createFileRoute("/api/public/denuncia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload;
        try {
          payload = Schema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "payload_invalido" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ipHash = sha256(
          (request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for") ??
            "0.0.0.0") + ":sigmo-denuncia",
        );
        const uaHash = sha256((request.headers.get("user-agent") ?? "") + ":sigmo-denuncia");

        const { data, error } = await supabaseAdmin
          .from("psico_denuncias")
          .insert({
            company_id: payload.company_id ?? null,
            categoria: payload.categoria,
            local_ocorrencia: payload.local_ocorrencia ?? null,
            data_aproximada: payload.data_aproximada || null,
            relato: payload.relato,
            quer_retorno: payload.quer_retorno,
            contato_retorno: payload.quer_retorno ? (payload.contato_retorno ?? null) : null,
            ip_hash: ipHash,
            ua_hash: uaHash,
          })
          .select("protocolo")
          .single();

        if (error) {
          console.error("[denuncia] insert", error);
          return Response.json({ ok: false, error: "db" }, { status: 500 });
        }
        return Response.json({ ok: true, protocolo: (data as any).protocolo });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

// GET /api/public/psico/:hash — valida token de campanha psicossocial
// Retorna dados mínimos pra montar o formulário no celular do colaborador.
// Não retorna nada que identifique quem gerou o token.
export const Route = createFileRoute("/api/public/psico/$hash")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const hash = sha256(params.hash);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tok, error } = await supabaseAdmin
          .from("psico_tokens")
          .select("id, campanha_id, ghe_id, usado_em, expira_em")
          .eq("token_hash", hash)
          .maybeSingle();

        if (error) return new Response(JSON.stringify({ ok: false, error: "db" }), { status: 500 });
        if (!tok) return Response.json({ ok: false, motivo: "TOKEN_INVALIDO" }, { status: 404 });
        if (tok.usado_em) return Response.json({ ok: false, motivo: "TOKEN_JA_USADO" }, { status: 410 });
        if (new Date(tok.expira_em).getTime() < Date.now())
          return Response.json({ ok: false, motivo: "TOKEN_EXPIRADO" }, { status: 410 });

        const { data: camp } = await supabaseAdmin
          .from("psico_campanhas")
          .select("id, titulo, descricao, status, data_inicio, data_fim, instrumento")
          .eq("id", tok.campanha_id)
          .maybeSingle();

        if (!camp || camp.status !== "ATIVA")
          return Response.json({ ok: false, motivo: "CAMPANHA_INATIVA" }, { status: 410 });

        let gheLabel: string | null = null;
        if (tok.ghe_id) {
          const { data: g } = await supabaseAdmin
            .from("pgr_ghe")
            .select("numero, setor")
            .eq("id", tok.ghe_id)
            .maybeSingle();
          if (g) gheLabel = `GHE ${g.numero} — ${g.setor}`;
        }

        return Response.json({
          ok: true,
          campanha: {
            id: camp.id,
            titulo: camp.titulo,
            descricao: camp.descricao,
            instrumento: camp.instrumento,
          },
          ghe: { id: tok.ghe_id, label: gheLabel },
        });
      },
    },
  },
});
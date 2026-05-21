import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/controle-documentos/gerar-recorrentes")({
  server: {
    handlers: {
      POST: async () => {
        const hoje = new Date();
        const hojeISO = hoje.toISOString().slice(0, 10);

        const { data: recorrentes, error } = await supabaseAdmin
          .from("controle_doc_recorrentes")
          .select("*")
          .eq("ativo", true);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        let criados = 0;
        for (const r of recorrentes ?? []) {
          if (!r.proxima_validade) continue;
          const validade = new Date(r.proxima_validade);
          const limite = new Date(validade);
          limite.setDate(limite.getDate() - (r.dias_aviso_previo ?? 30));
          if (limite > hoje) continue;

          // Já existe entrada aberta vinculada a este recorrente para esta validade?
          const { data: existentes } = await supabaseAdmin
            .from("controle_documentos")
            .select("id, status, prazo")
            .eq("recorrente_id", r.id)
            .neq("status", "RESOLVIDO")
            .neq("status", "CANCELADO");
          if ((existentes ?? []).some((e: any) => e.prazo === r.proxima_validade)) continue;

          await supabaseAdmin.from("controle_documentos").insert({
            titulo: `Renovação: ${r.nome}`,
            descricao: `Documento recorrente próximo do vencimento (${r.proxima_validade}).`,
            origem: "RECORRENTE_AUTO",
            data_recebimento: hojeISO,
            prazo: r.proxima_validade,
            categoria_id: r.categoria_id,
            criticidade: r.criticidade,
            responsavel_id: r.responsavel_id,
            recorrente_id: r.id,
            status: "RECEBIDO",
          } as any);
          criados++;
        }

        return new Response(JSON.stringify({ ok: true, criados }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
import { createFileRoute } from "@tanstack/react-router";

// TEMP: usado só para medir coordenadas do PDF-mãe em dev. Deletar depois.
export const Route = createFileRoute("/api/public/_dev-fetch-template")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        if (!path) return new Response("missing path", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("templates-homologados").download(path);
        if (error || !data) return new Response(error?.message ?? "not found", { status: 404 });
        const buf = await data.arrayBuffer();
        return new Response(buf, { headers: { "content-type": "application/pdf" } });
      },
    },
  },
});
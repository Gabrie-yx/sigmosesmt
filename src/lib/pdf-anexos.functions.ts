// Anexos padrão de PDF — helpers cliente/servidor.
// A concatenação com pdf-lib acontece no gerador de cada PDF (segunda passada).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const escopoSchema = z.enum(["apr", "oss", "pte", "dds", "os", "rc"]);

export const listarAnexosPorEscopo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { escopo: z.infer<typeof escopoSchema> }) =>
    z.object({ escopo: escopoSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("pdf_anexos_padrao")
      .select("id, escopo, titulo, descricao, arquivo_path, obrigatorio, ativo, ordem")
      .eq("escopo", data.escopo)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("titulo", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const signedUrlAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { arquivo_path: string; expira_seg?: number }) =>
    z.object({
      arquivo_path: z.string().min(1),
      expira_seg: z.number().int().min(60).max(60 * 60).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("pdf-anexos-padrao")
      .createSignedUrl(data.arquivo_path, data.expira_seg ?? 300);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
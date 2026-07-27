import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  documento_id: z.string().uuid().nullable().optional(),
  nome_arquivo: z.string().min(1),
  modulo: z.string().min(1),
  pdf_path: z.string().min(1),
  funcionarios: z
    .array(
      z.object({
        employee_id: z.string().uuid(),
        nome: z.string(),
        pagina: z.number().int().positive(),
      }),
    )
    .default([]),
  total_assinaturas: z.number().int().nonnegative(),
});

/**
 * Registra na trilha de auditoria (audit_logs) quem carimbou a assinatura
 * de quais funcionários, em qual documento. Exigência ISO 9001 / NR-01:
 * a assinatura digitalizada de terceiro só vale com rastreabilidade do operador.
 */
export const registrarCarimboAssinaturas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId, claims } = context as { userId: string; claims: any };
    const email = claims?.email ?? null;

    const { error } = await supabaseAdmin.from("audit_logs").insert({
      table_name: "documentos_assinados",
      action: "CARIMBO_ASSINATURA",
      record_id: data.documento_id ?? null,
      user_id: userId,
      user_email: email,
      new_data: {
        nome_arquivo: data.nome_arquivo,
        modulo: data.modulo,
        pdf_path: data.pdf_path,
        total_assinaturas: data.total_assinaturas,
        funcionarios: data.funcionarios,
        registrado_em: new Date().toISOString(),
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

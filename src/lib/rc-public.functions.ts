import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.string().uuid();

const COTACAO_MAX_ATTEMPTS = 5;
const COTACAO_WINDOW_MINUTES = 60;

function extractClientInfo() {
  const request = getRequest();
  const headers = request.headers;
  const fwd = headers.get("x-forwarded-for") ?? "";
  const ip =
    headers.get("cf-connecting-ip") ||
    fwd.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;
  const ua = headers.get("user-agent")?.slice(0, 300) ?? null;
  return { ip, ua };
}

export const getRcByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: tokenSchema.parse(input.token) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rc, error } = await supabaseAdmin
      .from("purchase_requisitions")
      .select(
        "id, numero, data_requisicao, classificacao, solicitante, setor, fornecedor, obra_construcao, obra_manutencao, observacoes, status, motivo_indeferimento, approved_at, cotacao_at, cotador_nome, cotacao_fornecedor, cotacao_valor, created_at"
      )
      .eq("status_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rc) throw new Error("Requisição não encontrada");

    const { data: itens } = await supabaseAdmin
      .from("purchase_requisition_items")
      .select("item_numero, descricao, quantidade, unidade, observacao")
      .eq("requisition_id", rc.id)
      .order("item_numero");

    return { rc, itens: itens ?? [] };
  });

export const marcarRcCotada = createServerFn({ method: "POST" })
  .inputValidator((input: {
    token: string;
    cotador_nome: string;
    fornecedor: string;
    valor: number;
  }) =>
    z
      .object({
        token: tokenSchema,
        cotador_nome: z.string().min(2).max(120),
        fornecedor: z.string().min(1).max(200),
        valor: z.number().min(0).max(99999999),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ip, ua } = extractClientInfo();

    const { data: rc, error: e1 } = await supabaseAdmin
      .from("purchase_requisitions")
      .select(
        "id, status, cotacao_attempt_count, cotacao_last_attempt_at, cotacao_submitted_at"
      )
      .eq("status_token", data.token)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!rc) throw new Error("Requisição não encontrada");

    // Rate limit por token: máximo N tentativas dentro da janela
    const lastAttempt = (rc as any).cotacao_last_attempt_at as string | null;
    const attempts = (rc as any).cotacao_attempt_count as number | null;
    const windowMs = COTACAO_WINDOW_MINUTES * 60 * 1000;
    const withinWindow =
      lastAttempt && Date.now() - new Date(lastAttempt).getTime() < windowMs;
    if (withinWindow && (attempts ?? 0) >= COTACAO_MAX_ATTEMPTS) {
      throw new Error(
        `Limite de ${COTACAO_MAX_ATTEMPTS} tentativas atingido. Tente novamente em alguns minutos.`,
      );
    }
    const newAttemptCount = withinWindow ? (attempts ?? 0) + 1 : 1;

    // Registra a tentativa ANTES de validar status (audit trail mesmo em recusa)
    await supabaseAdmin
      .from("purchase_requisitions")
      .update({
        cotacao_attempt_count: newAttemptCount,
        cotacao_last_attempt_at: new Date().toISOString(),
        cotacao_submitter_ip: ip,
        cotacao_user_agent: ua,
      } as any)
      .eq("id", rc.id);

    if (rc.status !== "PENDENTE") {
      throw new Error("Esta RC já saiu da etapa de cotação.");
    }
    const { error } = await supabaseAdmin
      .from("purchase_requisitions")
      .update({
        status: "COTADA",
        cotador_nome: data.cotador_nome,
        cotacao_fornecedor: data.fornecedor,
        cotacao_valor: data.valor,
        cotacao_at: new Date().toISOString(),
        cotacao_submitted_at: new Date().toISOString(),
      } as any)
      .eq("id", rc.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decidirRc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    token: string;
    decisao: "APROVADA" | "INDEFERIDA";
    motivo?: string;
  }) =>
    z
      .object({
        token: tokenSchema,
        decisao: z.enum(["APROVADA", "INDEFERIDA"]),
        motivo: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;

    // Só admin ou moderador pode decidir
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const rolesList = (roles ?? []).map((r: any) => r.role);
    if (!rolesList.includes("admin") && !rolesList.includes("moderador")) {
      throw new Error("Apenas gerentes (admin/moderador) podem aprovar requisições.");
    }

    const { data: rc, error: e1 } = await supabaseAdmin
      .from("purchase_requisitions")
      .select("id, status")
      .eq("status_token", data.token)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!rc) throw new Error("Requisição não encontrada");
    if (rc.status === "APROVADA" || rc.status === "INDEFERIDA") {
      throw new Error("Esta RC já foi decidida.");
    }
    if (data.decisao === "INDEFERIDA" && !data.motivo?.trim()) {
      throw new Error("Informe o motivo do indeferimento.");
    }
    const { error } = await supabaseAdmin
      .from("purchase_requisitions")
      .update({
        status: data.decisao,
        motivo_indeferimento: data.decisao === "INDEFERIDA" ? data.motivo : null,
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq("id", rc.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
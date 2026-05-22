import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tokenSchema = z.string().uuid();

export const getRcByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: tokenSchema.parse(input.token) }))
  .handler(async ({ data }) => {
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
    const { data: rc, error: e1 } = await supabaseAdmin
      .from("purchase_requisitions")
      .select("id, status")
      .eq("status_token", data.token)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!rc) throw new Error("Requisição não encontrada");
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
      })
      .eq("id", rc.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decidirRc = createServerFn({ method: "POST" })
  .inputValidator((input: {
    token: string;
    decisao: "APROVADA" | "INDEFERIDA";
    aprovador_nome: string;
    motivo?: string;
  }) =>
    z
      .object({
        token: tokenSchema,
        decisao: z.enum(["APROVADA", "INDEFERIDA"]),
        aprovador_nome: z.string().min(2).max(120),
        motivo: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
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
      })
      .eq("id", rc.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
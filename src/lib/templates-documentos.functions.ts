import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao validar permissão.");
  if (!data) throw new Error("Somente administradores podem gerenciar templates.");
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeB64(b64: string) {
  const bin = atob(b64);
  if (bin.length > MAX_PDF_BYTES) throw new Error("Arquivo maior que 20 MB.");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

/* ---------- LISTAR ---------- */
export const listarTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: templates, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: versions } = await supabase
      .from("document_template_versions")
      .select("id, template_id, revisao, status, uploaded_at, uploaded_by, motivo_alteracao, arquivo_hash, arquivo_nome, deleted_at")
      .is("deleted_at", null)
      .order("revisao", { ascending: false });

    const { data: pendencias } = await supabase
      .from("document_template_pendencias")
      .select("id, template_id, version_id, prazo_sugerido, resolvido_em")
      .is("resolvido_em", null);

    const byTemplate = new Map<string, any[]>();
    (versions ?? []).forEach((v: any) => {
      const arr = byTemplate.get(v.template_id) ?? [];
      arr.push(v);
      byTemplate.set(v.template_id, arr);
    });

    return (templates ?? []).map((t: any) => {
      const vs = byTemplate.get(t.id) ?? [];
      const atual = vs.find((v: any) => v.status === "HOMOLOGADA" || v.status === "EM_HOMOLOGACAO") ?? vs[0] ?? null;
      const pendente = (pendencias ?? []).find((p: any) => p.template_id === t.id) ?? null;
      return { ...t, versao_atual: atual, total_versoes: vs.length, pendente };
    });
  });

/* ---------- HISTÓRICO ---------- */
export const historicoTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ templateId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: versoes, error } = await context.supabase
      .from("document_template_versions")
      .select("*")
      .eq("template_id", data.templateId)
      .order("revisao", { ascending: false });
    if (error) throw new Error(error.message);
    return versoes ?? [];
  });

/* ---------- URL ASSINADA PARA DOWNLOAD ---------- */
export const signedUrlTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ versionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v, error } = await supabaseAdmin
      .from("document_template_versions")
      .select("arquivo_path, arquivo_nome")
      .eq("id", data.versionId)
      .single();
    if (error || !v) throw new Error("Versão não encontrada.");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("templates-homologados")
      .createSignedUrl(v.arquivo_path, 300, { download: v.arquivo_nome });
    if (sErr || !signed) throw new Error("Falha ao gerar link de download.");
    return { url: signed.signedUrl, nome: v.arquivo_nome };
  });

/* ---------- BAIXAR PDF ATIVO DE UM TEMPLATE (por código) ----------
 * Usado pelos motores de geração de documento (Avaliação de Reação, etc.)
 * para sobrepor os campos variáveis em cima do PDF oficial homologado.
 * Requer usuário autenticado — não é admin-only. */
export const baixarTemplateAtivoPorCodigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ codigo: z.string().min(1).max(50) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("document_templates")
      .select("id, codigo, nome")
      .eq("codigo", data.codigo)
      .eq("ativo", true)
      .maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!tpl) throw new Error(`Template ${data.codigo} não encontrado ou inativo.`);

    const { data: vs, error: vsErr } = await supabaseAdmin
      .from("document_template_versions")
      .select("id, revisao, status, arquivo_path, arquivo_nome")
      .eq("template_id", tpl.id)
      .is("deleted_at", null)
      .order("revisao", { ascending: false });
    if (vsErr) throw new Error(vsErr.message);

    const atual =
      (vs ?? []).find((v: any) => v.status === "HOMOLOGADA") ??
      (vs ?? []).find((v: any) => v.status === "EM_HOMOLOGACAO") ??
      (vs ?? [])[0];
    if (!atual) throw new Error(`Template ${data.codigo} sem versão disponível.`);

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("templates-homologados")
      .download(atual.arquivo_path);
    if (dlErr || !file) throw new Error(`Falha ao baixar PDF do template: ${dlErr?.message ?? ""}`);

    const buf = new Uint8Array(await file.arrayBuffer());
    // base64 seguro pra transportar no wire
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const base64 = btoa(bin);
    return {
      base64,
      codigo: tpl.codigo,
      revisao: atual.revisao as number,
      status: atual.status as string,
    };
  });

/* ---------- NOVA REVISÃO ---------- */
const NovaRevisaoSchema = z.object({
  templateId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1),
  base64: z.string().min(1),
  motivo: z.string().min(3).max(1000),
});

export const novaRevisaoTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => NovaRevisaoSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (data.contentType !== "application/pdf" && !data.fileName.toLowerCase().endsWith(".pdf")) {
      throw new Error("Apenas arquivos PDF são aceitos.");
    }
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("document_templates")
      .select("id, codigo")
      .eq("id", data.templateId)
      .single();
    if (tplErr || !tpl) throw new Error("Template não encontrado.");

    // Descobre próxima revisão
    const { data: ultima } = await supabaseAdmin
      .from("document_template_versions")
      .select("revisao")
      .eq("template_id", data.templateId)
      .order("revisao", { ascending: false })
      .limit(1);
    const proxima = ((ultima?.[0]?.revisao ?? 0) as number) + 1;

    const buffer = decodeB64(data.base64);
    const hash = await sha256Hex(buffer);
    const path = `${tpl.codigo}/rev-${String(proxima).padStart(2, "0")}-${Date.now()}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("templates-homologados")
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

    // Marca revisões anteriores ativas como SUPERSEDIDA
    await supabaseAdmin
      .from("document_template_versions")
      .update({ status: "SUPERSEDIDA" })
      .eq("template_id", data.templateId)
      .in("status", ["HOMOLOGADA", "EM_HOMOLOGACAO"])
      .is("deleted_at", null);

    const { data: nova, error: insErr } = await supabaseAdmin
      .from("document_template_versions")
      .insert({
        template_id: data.templateId,
        revisao: proxima,
        arquivo_path: path,
        arquivo_nome: data.fileName,
        arquivo_hash: hash,
        tamanho_bytes: buffer.byteLength,
        motivo_alteracao: data.motivo,
        status: "EM_HOMOLOGACAO",
        uploaded_by: context.userId,
      })
      .select()
      .single();
    if (insErr || !nova) {
      await supabaseAdmin.storage.from("templates-homologados").remove([path]);
      throw new Error(`Falha ao registrar versão: ${insErr?.message ?? ""}`);
    }

    // Cria pendência automática (+15 dias)
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + 15);
    await supabaseAdmin.from("document_template_pendencias").insert({
      version_id: nova.id,
      template_id: data.templateId,
      prazo_sugerido: prazo.toISOString().slice(0, 10),
      nota: `Rev.${String(proxima).padStart(2, "0")} enviada — motor de render precisa alinhar.`,
    });

    return { ok: true, revisao: proxima };
  });

/* ---------- HOMOLOGAR ---------- */
export const homologarVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ versionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("document_template_versions")
      .update({ status: "HOMOLOGADA", homologada_em: new Date().toISOString(), homologada_por: context.userId })
      .eq("id", data.versionId);
    if (error) throw new Error(error.message);
    // Resolve a pendência dessa versão
    await supabaseAdmin
      .from("document_template_pendencias")
      .update({ resolvido_em: new Date().toISOString(), resolvido_por: context.userId })
      .eq("version_id", data.versionId)
      .is("resolvido_em", null);
    return { ok: true };
  });

/* ---------- SOFT DELETE ---------- */
export const arquivarVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ versionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("document_template_versions")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.versionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- RESTAURAR ---------- */
export const restaurarVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ versionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("document_template_versions")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", data.versionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- HARD DELETE (remove definitivo: banco + storage) ----------
 * Usar quando o admin sobe o PDF errado e quer literalmente apagar o
 * arquivo, sem deixar rastro no histórico. Soft delete continua sendo
 * o caminho padrão pra revisões válidas que só foram superadas. */
export const excluirVersaoDefinitivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ versionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: v, error: vErr } = await supabaseAdmin
      .from("document_template_versions")
      .select("id, template_id, arquivo_path, status")
      .eq("id", data.versionId)
      .single();
    if (vErr || !v) throw new Error("Versão não encontrada.");

    // remove pendências vinculadas
    await supabaseAdmin
      .from("document_template_pendencias")
      .delete()
      .eq("version_id", data.versionId);

    // remove registro do banco
    const { error: delErr } = await supabaseAdmin
      .from("document_template_versions")
      .delete()
      .eq("id", data.versionId);
    if (delErr) throw new Error(`Falha ao excluir versão: ${delErr.message}`);

    // remove arquivo do storage (não bloqueia se falhar)
    if (v.arquivo_path) {
      await supabaseAdmin.storage.from("templates-homologados").remove([v.arquivo_path]);
    }

    // se essa era a revisão ativa, promove a anterior mais recente
    if (v.status === "HOMOLOGADA" || v.status === "EM_HOMOLOGACAO") {
      const { data: anterior } = await supabaseAdmin
        .from("document_template_versions")
        .select("id, revisao")
        .eq("template_id", v.template_id)
        .is("deleted_at", null)
        .eq("status", "SUPERSEDIDA")
        .order("revisao", { ascending: false })
        .limit(1);
      if (anterior && anterior[0]) {
        await supabaseAdmin
          .from("document_template_versions")
          .update({ status: "HOMOLOGADA" })
          .eq("id", anterior[0].id);
      }
    }

    return { ok: true };
  });
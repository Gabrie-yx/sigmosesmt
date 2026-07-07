import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transferência de funcionário entre empresas.
 * - Só admin ou moderador pode chamar
 * - Motivo é obrigatório
 * - Para cada APR/PTE aberta do funcionário, o caller decide:
 *     { action: "REASSIGN", to_employee_id } → transfere a assinatura pra outro
 *     { action: "ARCHIVE" }                  → arquiva o documento (cancelada_por_transferencia)
 * - GHE do funcionário permanece (pgr_ghe é global no projeto)
 * - Grava linha em employee_company_history
 */

type DocDecision =
  | { action: "REASSIGN"; to_employee_id: string }
  | { action: "ARCHIVE" };

const decisionSchema: z.ZodType<DocDecision> = z.union([
  z.object({ action: z.literal("REASSIGN"), to_employee_id: z.string().uuid() }),
  z.object({ action: z.literal("ARCHIVE") }),
]);

async function assertAdminOrModerador(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "moderador"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Apenas admin ou moderador pode transferir funcionários");
  }
}

/**
 * Lista APRs (via apr_assinaturas) e PTEs abertas onde o funcionário
 * ainda tem vínculo ativo. Usado pelo wizard pra pedir a decisão.
 */
export const listPendenciasParaTransferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ employee_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdminOrModerador(context.supabase, context.userId);
    const sb = context.supabase;

    // APRs: qualquer assinatura vinculada ao funcionário cuja APR não esteja cancelada
    const { data: apAssigs, error: e1 } = await sb
      .from("apr_assinaturas")
      .select("id, papel, apr_id, aprs!inner(id, numero, status, cancelada_em, data_emissao)")
      .eq("employee_id", data.employee_id);
    if (e1) throw new Error(e1.message);

    const aprs = (apAssigs ?? [])
      .filter((r: any) => r.aprs && !r.aprs.cancelada_em)
      .map((r: any) => ({
        assinatura_id: r.id,
        apr_id: r.aprs.id,
        numero: r.aprs.numero,
        papel: r.papel,
        data_emissao: r.aprs.data_emissao,
      }));

    // PTEs: employee_id direto
    const { data: ptes, error: e2 } = await sb
      .from("ptes")
      .select("id, numero, tipo_pt, data_emissao, status, cancelada_em")
      .eq("employee_id", data.employee_id)
      .is("cancelada_em", null);
    if (e2) throw new Error(e2.message);

    return { aprs, ptes: ptes ?? [] };
  });

export const transferEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      employee_id: z.string().uuid(),
      nova_empresa_id: z.string().uuid(),
      motivo: z.string().trim().min(5, "Motivo é obrigatório (mínimo 5 caracteres)"),
      decisoes_aprs: z.array(
        z.object({
          assinatura_id: z.string().uuid(),
          apr_id: z.string().uuid(),
          decision: decisionSchema,
        })
      ).default([]),
      decisoes_ptes: z.array(
        z.object({
          pte_id: z.string().uuid(),
          decision: decisionSchema,
        })
      ).default([]),
    })
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrModerador(context.supabase, context.userId);
    const sb = context.supabase;

    // 1. Estado atual do funcionário
    const { data: emp, error: eEmp } = await sb
      .from("employees")
      .select("id, nome, company_id, status")
      .eq("id", data.employee_id)
      .maybeSingle();
    if (eEmp) throw new Error(eEmp.message);
    if (!emp) throw new Error("Funcionário não encontrado");
    if (emp.status === "DESLIGADO") throw new Error("Funcionário desligado — reative antes de transferir");
    if (emp.company_id === data.nova_empresa_id) throw new Error("A empresa nova é a mesma da atual");

    // 2. Confere que todas as pendências têm decisão
    const pendentes = await (async () => {
      const [apAssigs, ptes] = await Promise.all([
        sb.from("apr_assinaturas")
          .select("id, apr_id, aprs!inner(id, cancelada_em)")
          .eq("employee_id", data.employee_id),
        sb.from("ptes")
          .select("id")
          .eq("employee_id", data.employee_id)
          .is("cancelada_em", null),
      ]);
      const aprIds = new Set(
        (apAssigs.data ?? [])
          .filter((r: any) => r.aprs && !r.aprs.cancelada_em)
          .map((r: any) => r.id)
      );
      const pteIds = new Set((ptes.data ?? []).map((p: any) => p.id));
      return { aprIds, pteIds };
    })();

    const cobertoApr = new Set(data.decisoes_aprs.map((d) => d.assinatura_id));
    const cobertoPte = new Set(data.decisoes_ptes.map((d) => d.pte_id));
    for (const id of pendentes.aprIds) {
      if (!cobertoApr.has(id)) throw new Error("Existem APRs pendentes sem decisão de transferência");
    }
    for (const id of pendentes.pteIds) {
      if (!cobertoPte.has(id)) throw new Error("Existem PTEs pendentes sem decisão de transferência");
    }

    // 3. Executa decisões APR
    let aprsReat = 0, aprsArq = 0;
    for (const d of data.decisoes_aprs) {
      if (d.decision.action === "REASSIGN") {
        const { error } = await sb
          .from("apr_assinaturas")
          .update({ employee_id: d.decision.to_employee_id })
          .eq("id", d.assinatura_id);
        if (error) throw new Error(`APR reatribuição: ${error.message}`);
        aprsReat++;
      } else {
        const { error } = await sb
          .from("aprs")
          .update({
            status: "CANCELADA",
            cancelada_em: new Date().toISOString(),
            cancelada_motivo: `Transferência de empresa: ${data.motivo}`,
            cancelada_por: context.userId,
          })
          .eq("id", d.apr_id);
        if (error) throw new Error(`APR arquivamento: ${error.message}`);
        aprsArq++;
      }
    }

    // 4. Executa decisões PTE
    let ptesReat = 0, ptesArq = 0;
    for (const d of data.decisoes_ptes) {
      if (d.decision.action === "REASSIGN") {
        const { error } = await sb
          .from("ptes")
          .update({ employee_id: d.decision.to_employee_id })
          .eq("id", d.pte_id);
        if (error) throw new Error(`PTE reatribuição: ${error.message}`);
        ptesReat++;
      } else {
        const { error } = await sb
          .from("ptes")
          .update({
            status: "CANCELADA",
            cancelada_em: new Date().toISOString(),
            cancelada_motivo: `Transferência de empresa: ${data.motivo}`,
            cancelada_por: context.userId,
          })
          .eq("id", d.pte_id);
        if (error) throw new Error(`PTE arquivamento: ${error.message}`);
        ptesArq++;
      }
    }

    // 5. Atualiza company_id do funcionário
    const { error: eUpd } = await sb
      .from("employees")
      .update({ company_id: data.nova_empresa_id })
      .eq("id", data.employee_id);
    if (eUpd) throw new Error(`Atualização de empresa: ${eUpd.message}`);

    // 6. Grava histórico
    const { error: eHist } = await sb
      .from("employee_company_history")
      .insert({
        employee_id: data.employee_id,
        empresa_antiga_id: emp.company_id,
        empresa_nova_id: data.nova_empresa_id,
        transferido_por: context.userId,
        motivo: data.motivo,
        aprs_reatribuidas: aprsReat,
        aprs_arquivadas: aprsArq,
        ptes_reatribuidas: ptesReat,
        ptes_arquivadas: ptesArq,
      });
    if (eHist) throw new Error(`Histórico: ${eHist.message}`);

    return {
      ok: true,
      aprs_reatribuidas: aprsReat,
      aprs_arquivadas: aprsArq,
      ptes_reatribuidas: ptesReat,
      ptes_arquivadas: ptesArq,
    };
  });

export const listEmployeeCompanyHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ employee_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("employee_company_history")
      .select("*, empresa_antiga:companies!employee_company_history_empresa_antiga_id_fkey(name), empresa_nova:companies!employee_company_history_empresa_nova_id_fkey(name)")
      .eq("employee_id", data.employee_id)
      .order("transferido_em", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
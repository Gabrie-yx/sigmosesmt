import { supabase } from "@/integrations/supabase/client";

export interface SafetyOverride {
  id: string;
  employee_id: string;
  scope: "GLOBAL" | "ITEM";
  item_key: string | null;
  justificativa: string;
  liberado_por: string;
  liberado_por_email: string | null;
  liberado_em: string;
  expira_em: string | null;
  ativo: boolean;
  revogado_por: string | null;
  revogado_em: string | null;
  motivo_revogacao: string | null;
}

/** Retorna apenas overrides ATIVOS e não expirados. */
export function filterActiveOverrides(list: SafetyOverride[] | null | undefined): SafetyOverride[] {
  if (!list) return [];
  const now = Date.now();
  return list.filter(
    (o) =>
      o.ativo &&
      (!o.expira_em || new Date(o.expira_em).getTime() > now) &&
      (!o.liberado_em || new Date(o.liberado_em).getTime() <= now),
  );
}

/**
 * Decide se uma mensagem de bloqueio do safety-engine está coberta por algum override.
 * - GLOBAL: cobre tudo.
 * - ITEM com item_key tipo 'ASO', 'INTEGRACAO', 'NR-35', 'EXAME:Audiometria', 'VACINA:Hep B', 'PTE'.
 */
export function isMessageOverridden(msg: string, overrides: SafetyOverride[]): boolean {
  const active = filterActiveOverrides(overrides);
  if (active.some((o) => o.scope === "GLOBAL")) return true;
  const m = msg.toLowerCase();
  for (const o of active) {
    if (o.scope !== "ITEM" || !o.item_key) continue;
    const key = o.item_key;
    if (key === "ASO" && (m.startsWith("aso") || m.includes("falta aso") || m.includes("aso "))) return true;
    if (key === "INTEGRACAO" && m.includes("integra")) return true;
    if (key === "PTE" && m.includes("pte")) return true;
    if (key === "OS" && (m.includes("os assinada") || m.includes("os vencida") || m.includes("ordem de servi"))) return true;
    if (key.startsWith("NR-") && m.includes(key.toLowerCase())) return true;
    if (key.startsWith("EXAME:")) {
      const exame = key.slice(6).toLowerCase();
      if (m.includes(exame)) return true;
    }
    if (key.startsWith("VACINA:")) {
      const vac = key.slice(7).toLowerCase().split(" ")[0];
      if (m.includes("vacina") && m.includes(vac)) return true;
    }
  }
  return false;
}

export function hasGlobalOverride(overrides: SafetyOverride[] | null | undefined): boolean {
  return filterActiveOverrides(overrides).some((o) => o.scope === "GLOBAL");
}

export async function fetchOverridesByEmployee(employeeId: string): Promise<SafetyOverride[]> {
  const { data, error } = await supabase
    .from("safety_overrides")
    .select("*")
    .eq("employee_id", employeeId)
    .order("liberado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SafetyOverride[];
}

export async function fetchAllActiveOverrides(): Promise<SafetyOverride[]> {
  const { data, error } = await supabase
    .from("safety_overrides")
    .select("*")
    .eq("ativo", true);
  if (error) throw error;
  return filterActiveOverrides((data ?? []) as SafetyOverride[]);
}
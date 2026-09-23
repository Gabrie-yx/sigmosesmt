import { supabase } from "@/integrations/supabase/client";

export type OssCargoPayload = {
  setor: string | null;
  cbo: string | null;
  descricao_atividades: string;
  riscos_texto: string;
  medidas_preventivas: string;
  epis_obrigatorios: string;
  risco_fisico: string;
  risco_quimico: string;
  risco_biologico: string;
  risco_ergonomico: string;
  risco_acidente: string;
  risco_psicossocial: string;
};

const CATEGORY_FIELDS: Record<string, keyof OssCargoPayload> = {
  FISICO: "risco_fisico",
  QUIMICO: "risco_quimico",
  BIOLOGICO: "risco_biologico",
  ERGONOMICO: "risco_ergonomico",
  ACIDENTE_MECANICO: "risco_acidente",
  PSICOSSOCIAL: "risco_psicossocial",
};

const ROLE_RISK_FIELDS: Record<string, string> = {
  FISICO: "fisicos",
  QUIMICO: "quimicos",
  BIOLOGICO: "biologicos",
  ERGONOMICO: "ergonomicos",
  ACIDENTE_MECANICO: "acidente_mecanico",
  PSICOSSOCIAL: "psicossociais",
};

function asUsefulList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((item) => String(item).trim())
    .filter((item) => item && !/^nenhum/i.test(item) && !/^n\/?a$/i.test(item));
}

function bullets(values: Iterable<string>) {
  return [...values].filter(Boolean).map((value) => `• ${value}`).join("\n");
}

/**
 * Lê novamente o cargo no banco para que a emissão não dependa de um modelo
 * antigo nem do cache da tela. Esta é a fonte usada para criar, atualizar e
 * reparar o snapshot de uma OS.
 */
export async function getOssCargoContent(employeeId: string) {
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, role_id, roles(name, cbo, setor, descricao_atividades, riscos, epis)")
    .eq("id", employeeId)
    .single();
  if (employeeError) throw employeeError;

  const row = employee as any;
  const role = row?.roles as any;
  if (!row?.role_id || !role) {
    throw new Error("O funcionário não está vinculado a um cargo válido.");
  }

  const buckets: Record<string, string[]> = {};
  const medidas = new Set<string>();
  const epis = new Set<string>();

  for (const epi of Array.isArray(role.epis) ? role.epis : []) {
    const nome = String(epi?.nome ?? "").trim();
    const ca = String(epi?.ca ?? "").trim();
    if (nome) epis.add(ca ? `${nome} - CA ${ca}` : nome);
  }

  const { data: riskRows, error: riskError } = await supabase
    .from("cargo_riscos")
    .select("*, catalogo_riscos(nome, categoria, medidas_controle_padrao, epis_sugeridos)")
    .eq("role_id", row.role_id)
    .eq("ativo", true);
  if (riskError) throw riskError;

  for (const risk of (riskRows ?? []) as any[]) {
    const category = String(risk.catalogo_riscos?.categoria ?? "").toUpperCase();
    if (!CATEGORY_FIELDS[category]) continue;
    const name = String(risk.catalogo_riscos?.nome ?? "Risco ocupacional").trim();
    const intensity = risk.intensidade != null ? ` — ${risk.intensidade}${risk.unidade ?? ""}` : "";
    const source = risk.fonte_geradora ? ` (fonte: ${risk.fonte_geradora})` : "";
    (buckets[category] ||= []).push(`${name}${intensity}${source}`);

    for (const item of risk.catalogo_riscos?.medidas_controle_padrao ?? []) medidas.add(String(item));
    for (const item of [risk.meios_controle, risk.epc_eficaz].filter(Boolean)) medidas.add(String(item));
    for (const item of risk.catalogo_riscos?.epis_sugeridos ?? []) epis.add(String(item));
    if (risk.epi_eficaz) {
      epis.add(`${risk.epi_eficaz}${risk.ca_epi ? ` - CA ${risk.ca_epi}` : ""}`);
    }
  }

  const roleRisks = (role.riscos ?? {}) as Record<string, unknown>;
  for (const [category, roleField] of Object.entries(ROLE_RISK_FIELDS)) {
    if (buckets[category]?.length) continue;
    const values = asUsefulList(roleRisks[roleField]);
    if (values.length) buckets[category] = values;
  }

  const payload: OssCargoPayload = {
    setor: role.setor ?? null,
    cbo: role.cbo ?? null,
    descricao_atividades: String(role.descricao_atividades ?? roleRisks.descricao ?? "").trim(),
    riscos_texto: "",
    medidas_preventivas: bullets(medidas),
    epis_obrigatorios: bullets(epis),
    risco_fisico: "",
    risco_quimico: "",
    risco_biologico: "",
    risco_ergonomico: "",
    risco_acidente: "",
    risco_psicossocial: "",
  };

  for (const [category, field] of Object.entries(CATEGORY_FIELDS)) {
    payload[field] = bullets(buckets[category] ?? []) as never;
  }

  return {
    cargo: String(role.name ?? "").trim(),
    payload,
    riskCount: Object.values(buckets).reduce((sum, values) => sum + values.length, 0),
    epiCount: epis.size,
  };
}

export function mergeOssContent(
  template: Record<string, any>,
  cargo: OssCargoPayload,
) {
  const preferCargo = (key: keyof OssCargoPayload) => {
    const current = cargo[key];
    return typeof current === "string" && current.trim() ? current : template[key] ?? "";
  };

  return {
    cbo: preferCargo("cbo"),
    setor: preferCargo("setor"),
    descricao_atividades: preferCargo("descricao_atividades"),
    riscos_texto: template.riscos_texto ?? "",
    medidas_preventivas: preferCargo("medidas_preventivas"),
    epis_obrigatorios: preferCargo("epis_obrigatorios"),
    proibicoes: template.proibicoes ?? "",
    penalidades: template.penalidades ?? "",
    procedimentos_emergencia: template.procedimentos_emergencia ?? "",
    riscos_categorias: {
      fisico: preferCargo("risco_fisico"),
      quimico: preferCargo("risco_quimico"),
      biologico: preferCargo("risco_biologico"),
      ergonomico: preferCargo("risco_ergonomico"),
      acidente: preferCargo("risco_acidente"),
      psicossocial: preferCargo("risco_psicossocial"),
    },
  };
}
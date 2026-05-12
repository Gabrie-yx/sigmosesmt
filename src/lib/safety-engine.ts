import { daysUntil, addYearsToDate } from "./utils-date";
import { type SafetyOverride, filterActiveOverrides, hasGlobalOverride, isMessageOverridden } from "./safety-overrides";

export type SafetyLabel = "APTO" | "ALERTA" | "BLOQUEADO" | "INATIVO" | "AFASTADO" | "SEM CARGO";

export interface SafetyStatus {
  label: SafetyLabel;
  msgs: string[];
  acessoPermitido: boolean;
  colorClass: string;
}

export interface EngineEmployee {
  id: string;
  status: string | null;
  data_aso: string | null;
  data_integracao: string | null;
  nrs: Record<string, string> | null;
  role_id: string | null;
}

export interface EngineRole {
  id: string;
  name: string;
  req_aso: boolean;
  req_integra: boolean;
  req_nrs: string[];
  req_exames?: string[];
  req_vacinas?: string[];
  risco_biologico?: boolean;
}

export interface EngineExam {
  tipo_exame: string;
  data_realizacao: string;
  data_vencimento: string;
  aptidao: string;
  anexo_path?: string | null;
}

export interface EngineVaccine {
  tipo_vacina: string;
  data_aplicacao: string;
  data_proxima_dose?: string | null;
  anexo_path?: string | null;
}

export function calculateSafetyStatus(
  emp: EngineEmployee,
  role: EngineRole | null,
  exams: EngineExam[],
  vaccines: EngineVaccine[] = [],
  overrides: SafetyOverride[] = [],
): SafetyStatus {
  if (emp.status === "INATIVO")
    return { label: "INATIVO", msgs: [], acessoPermitido: false, colorClass: "bg-status-inativo" };
  if (emp.status === "AFASTADO")
    return { label: "AFASTADO", msgs: [], acessoPermitido: false, colorClass: "bg-status-inativo" };
  if (!role)
    return { label: "SEM CARGO", msgs: ["Função não definida"], acessoPermitido: false, colorClass: "bg-status-bloqueado" };

  let isRed = false;
  let isYellow = false;
  const msgs: string[] = [];

  const latest: Record<string, EngineExam> = {};
  exams.forEach((ex) => {
    if (
      !latest[ex.tipo_exame] ||
      new Date(ex.data_realizacao) > new Date(latest[ex.tipo_exame].data_realizacao)
    ) {
      latest[ex.tipo_exame] = ex;
    }
  });

  let hasValidAsoClinico = false;
  Object.values(latest).forEach((ex) => {
    if (ex.aptidao === "NÃO") {
      isRed = true;
      msgs.push(`${ex.tipo_exame} INAPTO`);
      return;
    }
    const d = daysUntil(ex.data_vencimento);
    if (d === null) return;
    const short = ex.tipo_exame === "ASO Clínico" ? "ASO" : ex.tipo_exame.split(" ")[0];
    if (ex.tipo_exame === "ASO Clínico" && d >= 0) hasValidAsoClinico = true;
    if (d < 0) {
      isRed = true;
      msgs.push(`${short} Vencido`);
    } else if (d <= 30) {
      isYellow = true;
      msgs.push(`${short} Vence em ${d}d`);
    }
  });

  // Required exams matrix (per role)
  const reqExames = role.req_exames ?? [];
  reqExames.forEach((tipo) => {
    const ex = latest[tipo];
    const short = tipo === "ASO Clínico" ? "ASO" : tipo.split(" ")[0];
    if (!ex) {
      isRed = true;
      msgs.push(`Falta ${short}`);
      return;
    }
    if (!ex.anexo_path) {
      isRed = true;
      msgs.push(`${short} sem PDF`);
    }
    const d = daysUntil(ex.data_vencimento);
    if (d !== null && d < 0) {
      isRed = true;
      if (!msgs.includes(`${short} Vencido`)) msgs.push(`${short} Vencido`);
    }
  });

  const checkLegacy = (date: string | null, name: string, isAsoFallback = false) => {
    if (!date) {
      if (!isAsoFallback || (!hasValidAsoClinico && exams.length === 0)) {
        isRed = true;
        msgs.push(`Falta ${name}`);
      }
      return;
    }
    if (isAsoFallback && hasValidAsoClinico) return;
    const exp = addYearsToDate(date, 1);
    const d = daysUntil(exp);
    if (d === null) return;
    if (d < 0) {
      isRed = true;
      msgs.push(`${name} Vencido`);
    } else if (d <= 30) {
      isYellow = true;
      msgs.push(`${name} Vence em ${d}d`);
    }
  };

  if (role.req_aso) checkLegacy(emp.data_aso, "ASO", true);
  if (role.req_integra) checkLegacy(emp.data_integracao, "Integração");

  const empNrs = emp.nrs || {};
  role.req_nrs.forEach((nr) => {
    const date = empNrs[nr];
    if (!date) {
      isRed = true;
      msgs.push(`Falta ${nr}`);
      return;
    }
    const exp = addYearsToDate(date, 2);
    const d = daysUntil(exp);
    if (d === null) return;
    if (d < 0) {
      isRed = true;
      msgs.push(`${nr} Vencido`);
    } else if (d <= 30) {
      isYellow = true;
      msgs.push(`${nr} Vence em ${d}d`);
    }
  });

  // Vacinas obrigatórias (PCMSO – Risco Biológico)
  const reqVacinas = role.req_vacinas ?? [];
  if (reqVacinas.length) {
    const latestVac: Record<string, EngineVaccine> = {};
    vaccines.forEach((v) => {
      if (
        !latestVac[v.tipo_vacina] ||
        new Date(v.data_aplicacao) > new Date(latestVac[v.tipo_vacina].data_aplicacao)
      ) {
        latestVac[v.tipo_vacina] = v;
      }
    });
    reqVacinas.forEach((vac) => {
      const short = vac.split(" ")[0];
      const v = latestVac[vac];
      if (!v) {
        isRed = true;
        msgs.push(`Falta vacina ${short}`);
        return;
      }
      if (!v.anexo_path) {
        isRed = true;
        msgs.push(`Vacina ${short} sem carteira`);
      }
      if (v.data_proxima_dose) {
        const d = daysUntil(v.data_proxima_dose);
        if (d !== null && d < 0) {
          isRed = true;
          msgs.push(`Vacina ${short} vencida`);
        } else if (d !== null && d <= 30) {
          isYellow = true;
          msgs.push(`Vacina ${short} vence em ${d}d`);
        }
      }
    });
  }

  if (isRed)
  {
    const active = filterActiveOverrides(overrides);
    if (hasGlobalOverride(active)) {
      return {
        label: "APTO",
        msgs: [`LIBERADO MANUALMENTE — ${msgs.join(", ")}`],
        acessoPermitido: true,
        colorClass: "bg-status-alerta",
      };
    }
    // Filtra mensagens cobertas por overrides item-a-item
    const remaining = msgs.filter((m) => !isMessageOverridden(m, active));
    const liberadas = msgs.filter((m) => isMessageOverridden(m, active));
    if (remaining.length === 0) {
      return {
        label: "APTO",
        msgs: liberadas.length ? [`LIBERADO MANUALMENTE — ${liberadas.join(", ")}`] : [],
        acessoPermitido: true,
        colorClass: liberadas.length ? "bg-status-alerta" : "bg-status-apto",
      };
    }
    return { label: "BLOQUEADO", msgs: remaining, acessoPermitido: false, colorClass: "bg-status-bloqueado" };
  }
  if (isYellow)
    return { label: "ALERTA", msgs, acessoPermitido: true, colorClass: "bg-status-alerta" };
  return { label: "APTO", msgs: [], acessoPermitido: true, colorClass: "bg-status-apto" };
}
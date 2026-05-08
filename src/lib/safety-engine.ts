import { daysUntil, addYearsToDate } from "./utils-date";

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
}

export interface EngineExam {
  tipo_exame: string;
  data_realizacao: string;
  data_vencimento: string;
  aptidao: string;
}

export function calculateSafetyStatus(
  emp: EngineEmployee,
  role: EngineRole | null,
  exams: EngineExam[],
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

  if (isRed)
    return { label: "BLOQUEADO", msgs, acessoPermitido: false, colorClass: "bg-status-bloqueado" };
  if (isYellow)
    return { label: "ALERTA", msgs, acessoPermitido: true, colorClass: "bg-status-alerta" };
  return { label: "APTO", msgs: [], acessoPermitido: true, colorClass: "bg-status-apto" };
}
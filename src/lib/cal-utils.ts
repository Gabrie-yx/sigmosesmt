import type { Database } from "@/integrations/supabase/types";

export type CalStatus = Database["public"]["Enums"]["cal_status"];
export type CalCriticidade = Database["public"]["Enums"]["cal_criticidade"];
export type CalModulo = Database["public"]["Enums"]["cal_modulo_impactado"];

export const CAL_STATUS_LABEL: Record<CalStatus, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aplicavel: "Aplicável",
  nao_aplicavel: "Não Aplicável",
  em_tratativa: "Em Tratativa",
  atendido: "Atendido",
  monitoramento: "Monitoramento",
  revogado: "Revogado",
};

export const CAL_STATUS_ORDER: CalStatus[] = [
  "recebido",
  "em_analise",
  "aplicavel",
  "em_tratativa",
  "atendido",
  "monitoramento",
];

export const CAL_STATUS_COLOR: Record<CalStatus, string> = {
  recebido: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  em_analise: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  aplicavel: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  nao_aplicavel: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  em_tratativa: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  atendido: "bg-green-600/20 text-green-200 border-green-600/40",
  monitoramento: "bg-purple-500/15 text-purple-200 border-purple-500/30",
  revogado: "bg-red-500/10 text-red-300 border-red-500/30 line-through",
};

export const CAL_CRITICIDADE_LABEL: Record<CalCriticidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const CAL_CRITICIDADE_COLOR: Record<CalCriticidade, string> = {
  baixa: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  media: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  alta: "bg-orange-500/15 text-orange-200 border-orange-500/30",
  critica: "bg-red-600/25 text-red-200 border-red-600/40",
};

export const CAL_MODULOS: { value: CalModulo; label: string }[] = [
  { value: "plano_acoes", label: "Plano de Ações" },
  { value: "controle_documentos", label: "Controle de Documentos" },
  { value: "procedimentos", label: "Procedimentos / POP" },
  { value: "dds", label: "DDS" },
  { value: "pgr", label: "PGR" },
  { value: "matriz_treinamento", label: "Matriz de Treinamento" },
  { value: "pcmso", label: "PCMSO" },
  { value: "contratadas", label: "Contratadas" },
  { value: "epi", label: "EPI" },
];

export const CAL_MODULO_LABEL: Record<CalModulo, string> = Object.fromEntries(
  CAL_MODULOS.map((m) => [m.value, m.label]),
) as Record<CalModulo, string>;

export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

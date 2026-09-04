/**
 * Fila de autorizações de EPI (separação de função NR-06 / ISO 45001).
 *
 * TST/Admin AUTORIZA a entrega → almoxarifado ENTREGA e dá baixa.
 * O TST ainda pode dar baixa direta, mas isso fica registrado como exceção.
 */

export type MotivoEntregaEpi =
  | "PRIMEIRA_ENTREGA"
  | "TROCA_DESGASTE"
  | "EMPRESTIMO"
  | "PERDA_EXTRAVIO";

export const MOTIVO_EPI_LABEL: Record<MotivoEntregaEpi, string> = {
  PRIMEIRA_ENTREGA: "1ª Entrega",
  TROCA_DESGASTE: "Troca por desgaste / vencimento",
  EMPRESTIMO: "Empréstimo — uso temporário",
  PERDA_EXTRAVIO: "Reposição por perda / extravio",
};

export const MOTIVO_EPI_OPCOES: { value: MotivoEntregaEpi; label: string }[] = [
  { value: "PRIMEIRA_ENTREGA", label: "🟢 1ª Entrega — colaborador nunca recebeu este item" },
  { value: "TROCA_DESGASTE", label: "🔵 Troca por desgaste / vencimento — substitui o anterior" },
  { value: "EMPRESTIMO", label: "🟡 Empréstimo — uso temporário, com previsão de devolução" },
  { value: "PERDA_EXTRAVIO", label: "🔴 Reposição por perda / extravio — gera termo de responsabilidade" },
];

export const MOTIVO_EPI_COR: Record<MotivoEntregaEpi, string> = {
  PRIMEIRA_ENTREGA: "bg-emerald-600 text-white",
  TROCA_DESGASTE: "bg-sky-600 text-white",
  EMPRESTIMO: "bg-amber-500 text-white",
  PERDA_EXTRAVIO: "bg-rose-600 text-white",
};

export type StatusAutorizacaoEpi = "PENDENTE" | "ENTREGUE" | "EXPIRADA" | "CANCELADA";

export type AutorizacaoEpi = {
  id: string;
  employee_id: string;
  company_id: string | null;
  epi_descricao: string;
  estoque_epi_id: string | null;
  tamanho: string | null;
  quantidade: number;
  motivo: MotivoEntregaEpi;
  previsao_devolucao: string | null;
  gera_termo: boolean;
  observacoes: string | null;
  autorizado_por: string | null;
  autorizado_por_nome: string | null;
  status: StatusAutorizacaoEpi;
  expira_em: string;
  entregue_por: string | null;
  entregue_por_nome: string | null;
  entregue_em: string | null;
  entrega_excecao: boolean;
  epi_delivery_id: string | null;
  cancelado_motivo: string | null;
  created_at: string;
};

/** Prazo padrão de validade da autorização: 2 dias. */
export const AUTORIZACAO_VALIDADE_DIAS = 2;

export function expiraEmISO(dias = AUTORIZACAO_VALIDADE_DIAS) {
  return new Date(Date.now() + dias * 86400000).toISOString();
}

/** Texto amigável do tempo restante ("expira em 1d 4h" / "expirada"). */
export function tempoRestante(expiraEm: string) {
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return { vencida: true, label: "expirada" };
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  return { vencida: false, label: d > 0 ? `${d}d ${h % 24}h` : `${h}h` };
}

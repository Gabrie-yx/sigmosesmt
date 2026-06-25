import { supabase } from "@/integrations/supabase/client";

export type NaturezaExame =
  | "ADMISSIONAL"
  | "PERIODICO"
  | "MUDANCA_FUNCAO"
  | "RETORNO_TRABALHO"
  | "DEMISSIONAL"
  | "COMPLEMENTAR";

export const TIPO_EXAME_OPTIONS: { value: string; natureza: NaturezaExame }[] = [
  { value: "Exame Médico Admissional", natureza: "ADMISSIONAL" },
  { value: "Exame Médico Periódico", natureza: "PERIODICO" },
  { value: "Exame Médico de Retorno ao Trabalho", natureza: "RETORNO_TRABALHO" },
  { value: "Exame Médico de Mudança de Função", natureza: "MUDANCA_FUNCAO" },
  { value: "Exame Médico Demissional", natureza: "DEMISSIONAL" },
  { value: "Exame Médico Complementar", natureza: "COMPLEMENTAR" },
];

export function naturezaFromTipoExame(label: string): NaturezaExame {
  const f = TIPO_EXAME_OPTIONS.find((o) => o.value === label);
  return f?.natureza ?? "PERIODICO";
}

export type ExameResolvido = {
  exam_id: string;
  codigo: string;
  procedimento: string;
  obrigatorio: boolean;
  origem: string;
  motivo: string;
};

export async function resolverExamesFuncionario(
  employeeId: string,
  natureza: NaturezaExame,
): Promise<ExameResolvido[]> {
  const { data, error } = await supabase.rpc("resolver_exames_funcionario", {
    _employee_id: employeeId,
    _natureza: natureza,
  });
  if (error) throw error;
  return (data ?? []) as ExameResolvido[];
}

/**
 * Assinatura estável de uma lista de exames — usada para agrupar
 * funcionários que devem fazer EXATAMENTE o mesmo conjunto de exames
 * (vira um ofício coletivo único).
 */
export function assinaturaExames(lista: ExameResolvido[]): string {
  return lista
    .map((e) => e.exam_id)
    .sort()
    .join("|");
}
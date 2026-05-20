import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

/**
 * Baixa a última versão da Lista Técnica de um casco como .xlsx, com as
 * colunas PESO UNT REAL e PESO REAL já calculadas pelo sistema.
 */
export async function downloadListaTecnicaCalculadaPorCasco(
  cascoId: string,
  cascoNomeAmigavel?: string,
) {
  // 1) Última versão da LT do casco
  const { data: lista, error: e1 } = await supabase
    .from("producao_lista_tecnica")
    .select("id, versao, arquivo_nome")
    .eq("casco_id", cascoId)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (!lista) throw new Error("Nenhuma Lista Técnica importada para este casco ainda.");

  // 2) Itens (em páginas)
  const itens: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("producao_lista_tecnica_itens")
      .select("*")
      .eq("lista_id", (lista as any).id)
      .order("linha", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = data ?? [];
    itens.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  // 3) Monta planilha
  const header = [
    "CÓDIGO",
    "Descrição SAP",
    "ELEMENTOS",
    "Medida",
    "Unid",
    "Peso (kgf)",
    "Quantidade (m² / m / un.)",
    "Peso Total (Kgf) estimado",
    "Largura",
    "Larg",
    "Comprimento",
    "Comp",
    "Peso Atual",
    "Espessura",
    "Qtd.",
    "Ver Desenho Dobrar Conforme",
    "PESO UNT REAL",
    "PESO REAL",
  ];
  const rows = itens.map((it: any) => [
    it.codigo_sap,
    it.descricao_sap,
    it.elemento,
    it.medida,
    it.unidade,
    it.peso_unit_ref,
    it.quantidade,
    it.peso_total_estimado,
    it.largura_txt,
    it.largura_m,
    it.comprimento_txt,
    it.comprimento_m,
    it.peso_chapa,
    it.espessura_mm != null ? `${it.espessura_mm} mm` : null,
    it.qtd_pecas,
    it.obs_dobra,
    calcPesoUnitReal(it),
    calcPesoReal(it),
  ]);

  // Linha em branco + TOTAL
  const totalRowIdx = rows.length + 3; // 1 header + dados + 1 vazia
  const sumRange = (col: string) => `${col}2:${col}${rows.length + 1}`;
  const totalRow: any[] = new Array(header.length).fill(null);
  totalRow[15] = "TOTAL";
  totalRow[5] = { f: `SUM(${sumRange("F")})` };
  totalRow[7] = { f: `SUM(${sumRange("H")})` };
  totalRow[14] = { f: `SUM(${sumRange("O")})` };
  totalRow[16] = { f: `SUM(${sumRange("Q")})` };
  totalRow[17] = { f: `SUM(${sumRange("R")})` };

  const aoa: any[][] = [header, ...rows, [], totalRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Largura aproximada das colunas
  ws["!cols"] = [
    { wch: 12 }, { wch: 32 }, { wch: 30 }, { wch: 18 }, { wch: 6 },
    { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 7 },
    { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 7 },
    { wch: 22 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lista Técnica");

  const baseNome = cascoNomeAmigavel
    ? `LT_${cascoNomeAmigavel.replace(/\s+/g, "_")}_v${(lista as any).versao}`
    : (((lista as any).arquivo_nome ?? "lista_tecnica") as string)
        .replace(/\.xlsx?$/i, `_v${(lista as any).versao}_calculada`);
  XLSX.writeFile(wb, `${baseNome}.xlsx`);

  return { totalItens: rows.length, versao: (lista as any).versao, totalRowIdx };
}

function calcPesoUnitReal(it: any): number | null {
  if (it.peso_unit_real != null) return it.peso_unit_real;
  if (it.largura_m != null && it.comprimento_m != null && it.peso_chapa != null) {
    return Math.round(it.largura_m * it.comprimento_m * it.peso_chapa * 100) / 100;
  }
  if (it.peso_unit_ref != null && it.comprimento_m != null) {
    return Math.round(it.peso_unit_ref * it.comprimento_m * 100) / 100;
  }
  if (it.peso_unit_ref != null) return it.peso_unit_ref;
  return null;
}

function calcPesoReal(it: any): number | null {
  if (it.peso_real != null) return it.peso_real;
  const unit = calcPesoUnitReal(it);
  if (unit == null) return null;
  const mult = it.qtd_pecas ?? it.quantidade;
  if (mult == null) return null;
  return Math.round(unit * mult * 100) / 100;
}
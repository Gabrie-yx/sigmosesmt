import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { normalizeNome } from "@/lib/aso-status";
import { addMonthsToDate } from "@/lib/utils-date";

/**
 * Importa a "relação de ASOs" da clínica (planilha SOC / Excel) e alimenta
 * employee_exams + employees.data_aso — que são a base do ofício de convocação.
 *
 * Detecta as colunas pelo cabeçalho (sem depender da posição):
 *  - nome do empregado
 *  - data do último exame
 *  - periodicidade / tipo do último exame (opcional)
 *  - data do próximo exame (opcional; se ausente calcula pela periodicidade)
 */

type Linha = {
  nome: string;
  ultimo: string | null;
  proximo: string | null;
  natureza: string;
  periodicidade: number;
  employeeId?: string;
  matchNome?: string;
};

function toISO(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // serial date do Excel (base 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2]}-${br[1]}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function norm(v: any) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function mesesDe(texto: string): number {
  const t = norm(texto);
  const m = t.match(/(\d{1,2})\s*(mes|meses|m)\b/);
  if (m) return Number(m[1]);
  if (t.includes("semestral")) return 6;
  if (t.includes("bienal")) return 24;
  if (t.includes("trimestral")) return 3;
  return 12;
}

function naturezaDe(texto: string): string {
  const t = norm(texto);
  if (t.includes("admiss")) return "Admissional";
  if (t.includes("retorno")) return "Retorno ao Trabalho";
  if (t.includes("mudanca") || t.includes("mudança")) return "Mudança de Risco Ocupacional";
  if (t.includes("demiss")) return "Demissional";
  if (t.includes("semestral")) return "Semestral";
  return "Periódico";
}

export function AsoImportarDialog({
  open,
  onOpenChange,
  employees,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: { id: string; nome: string; matricula?: string | null }[];
  onImported?: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onFile(file: File) {
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

      // Acha a linha de cabeçalho: a que contém uma célula com "empregado" ou "nome"
      let headIdx = -1;
      for (let i = 0; i < Math.min(matrix.length, 30); i++) {
        const row = matrix[i].map(norm);
        if (row.some((c) => c.includes("empregado") || c === "nome" || c.includes("funcionario") || c.includes("colaborador"))) {
          headIdx = i; break;
        }
      }
      if (headIdx < 0) { toast.error("Não encontrei o cabeçalho (coluna com o nome do empregado)."); return; }

      const head = matrix[headIdx].map(norm);
      const findCol = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
      const colNome = findCol("empregado", "funcionario", "colaborador", "nome");
      const colUltimo = head.findIndex((h) => h.includes("ultimo") && h.includes("exame") && h.includes("data"));
      const colUltimoAlt = head.findIndex((h) => h.includes("data") && h.includes("exame") && !h.includes("proximo"));
      const colProximo = head.findIndex((h) => h.includes("proximo"));
      const colTipo = head.findIndex((h) => (h.includes("periodicidade") || h.includes("tipo")) && !h.includes("data"));

      const cU = colUltimo >= 0 ? colUltimo : colUltimoAlt;
      if (colNome < 0 || cU < 0) { toast.error("Planilha sem coluna de nome ou de data do último exame."); return; }

      const byNome = new Map(employees.map((e) => [normalizeNome(e.nome), e]));
      const out: Linha[] = [];
      for (let i = headIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        const nome = String(row?.[colNome] ?? "").trim();
        if (!nome || norm(nome).includes("empregado")) continue;
        const ultimo = toISO(row[cU]);
        if (!ultimo) continue;
        const tipoTxt = colTipo >= 0 ? String(row[colTipo] ?? "") : "";
        const periodicidade = mesesDe(tipoTxt);
        const proximo = colProximo >= 0 ? toISO(row[colProximo]) : null;
        const match = byNome.get(normalizeNome(nome));
        out.push({
          nome,
          ultimo,
          proximo: proximo ?? addMonthsToDate(ultimo, periodicidade),
          natureza: naturezaDe(tipoTxt),
          periodicidade,
          employeeId: match?.id,
          matchNome: match?.nome,
        });
      }
      if (!out.length) { toast.error("Nenhuma linha com data de exame encontrada."); return; }
      setLinhas(out);
      setFileName(file.name);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao ler a planilha");
    }
  }

  const casados = linhas.filter((l) => l.employeeId);
  const orfaos = linhas.filter((l) => !l.employeeId);

  async function importar() {
    setSaving(true);
    try {
      const rows = casados.map((l) => ({
        employee_id: l.employeeId!,
        tipo_exame: "ASO Clínico",
        natureza: l.natureza,
        periodicidade_meses: l.periodicidade,
        data_realizacao: l.ultimo!,
        data_vencimento: l.proximo!,
        aptidao: "SIM",
        observacoes: `Importado da relação de ASOs (${fileName}).`,
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("employee_exams").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      for (const l of casados) {
        await supabase.from("employees").update({ data_aso: l.ultimo }).eq("id", l.employeeId!);
      }
      toast.success(`${casados.length} ASO(s) importados.`);
      onImported?.();
      setLinhas([]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao importar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar relação de ASOs</DialogTitle>
          <DialogDescription>
            Planilha da clínica (.xlsx/.csv) com nome do empregado, data do último exame e periodicidade.
            Cada linha vira um registro de ASO e atualiza a data usada no ofício de convocação.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 cursor-pointer hover:bg-white/10">
          <Upload className="h-4 w-4" />
          <span className="text-sm">{fileName || "Selecionar planilha (.xlsx, .xls, .csv)"}</span>
          <input
            type="file" className="hidden" accept=".xlsx,.xls,.csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
        </label>

        {linhas.length > 0 && (
          <>
            <div className="flex gap-2 text-xs">
              <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />{casados.length} reconhecidos</Badge>
              {orfaos.length > 0 && (
                <Badge variant="outline" className="gap-1 text-amber-300 border-amber-400/40">
                  <AlertTriangle className="h-3 w-3" />{orfaos.length} sem funcionário correspondente
                </Badge>
              )}
            </div>
            <div className="flex-1 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
              {linhas.map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className={`flex-1 truncate ${l.employeeId ? "" : "text-amber-300"}`}>{l.nome}</span>
                  <span className="text-slate-400">{l.natureza} · {l.periodicidade}m</span>
                  <span className="tabular-nums">{l.ultimo?.split("-").reverse().join("/")}</span>
                  <span className="tabular-nums text-slate-400">→ {l.proximo?.split("-").reverse().join("/")}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={saving || casados.length === 0}>
            {saving ? "Importando…" : `Importar ${casados.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

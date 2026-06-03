import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Eye, RotateCw, Trash2, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type ArquivoRow = {
  id: string;
  equipamento_id: string;
  ano: number;
  mes: number;
  pdf_path: string;
  observacao: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

export function ArquivosLegadosPanel({ equipamentoId }: { equipamentoId: string }) {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [busyMes, setBusyMes] = useState<number | null>(null);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const arquivos = useQuery({
    queryKey: ["arquivos-legados", equipamentoId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_arquivos_legados")
        .select("*")
        .eq("equipamento_id", equipamentoId)
        .eq("ano", year)
        .order("mes");
      if (error) throw error;
      return (data ?? []) as ArquivoRow[];
    },
  });

  const byMes = useMemo(() => {
    const m: Record<number, ArquivoRow> = {};
    for (const a of arquivos.data ?? []) m[a.mes] = a;
    return m;
  }, [arquivos.data]);

  async function handleUpload(file: File, mes: number, existing?: ArquivoRow) {
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF acima de 20MB");
      return;
    }
    setBusyMes(mes);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Não autenticado");

      const path = `legados/${equipamentoId}/${year}-${String(mes).padStart(2, "0")}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("checklists-equipamentos")
        .upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      if (existing) {
        const { error } = await supabase
          .from("checklist_arquivos_legados")
          .update({ pdf_path: path, uploaded_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_arquivos_legados")
          .insert({ equipamento_id: equipamentoId, ano: year, mes, pdf_path: path, uploaded_by: uid });
        if (error) throw error;
      }
      toast.success(`PDF de ${MESES[mes - 1]}/${year} salvo`);
      qc.invalidateQueries({ queryKey: ["arquivos-legados", equipamentoId, year] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setBusyMes(null);
    }
  }

  async function handleVer(row: ArquivoRow) {
    const fname = `${MESES[row.mes - 1]}-${row.ano}.pdf`;
    await openStorageFile("checklists-equipamentos", row.pdf_path, fname);
  }

  async function handleDelete(row: ArquivoRow) {
    if (!confirm(`Remover PDF de ${MESES[row.mes - 1]}/${row.ano}?`)) return;
    setBusyMes(row.mes);
    try {
      await supabase.storage.from("checklists-equipamentos").remove([row.pdf_path]);
      const { error } = await supabase.from("checklist_arquivos_legados").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("PDF removido");
      qc.invalidateQueries({ queryKey: ["arquivos-legados", equipamentoId, year] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao remover");
    } finally {
      setBusyMes(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Arquivos Mensais · Checklists escaneados (legado)
            </p>
            <p className="text-xs text-slate-500">
              Suba o PDF assinado de cada mês. 1 arquivo por mês · até 20MB · auditável para ISO 9001.
            </p>
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {MESES.map((nome, idx) => {
            const mes = idx + 1;
            const row = byMes[mes];
            const busy = busyMes === mes;
            return (
              <div
                key={mes}
                className={cn(
                  "rounded-lg border p-3 flex items-center gap-3 transition",
                  row ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white",
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-md flex items-center justify-center shrink-0",
                  row ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400",
                )}>
                  {row ? <Check className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{nome}/{year}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {row
                      ? `Enviado em ${new Date(row.uploaded_at).toLocaleDateString("pt-BR")}`
                      : "Nenhum PDF enviado"}
                  </p>
                </div>
                <input
                  ref={(el) => { fileRefs.current[mes] = el; }}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, mes, row);
                    e.target.value = "";
                  }}
                />
                {row ? (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleVer(row)} title="Ver">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={() => fileRefs.current[mes]?.click()} title="Substituir">
                      <RotateCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" disabled={busy} onClick={() => handleDelete(row)} title="Remover">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRefs.current[mes]?.click()}>
                    <Upload className={cn("h-4 w-4 mr-1", busy && "animate-spin")} /> Upload
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
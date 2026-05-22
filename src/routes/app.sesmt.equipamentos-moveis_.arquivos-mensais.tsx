import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Eye, RotateCw, Trash2, FileText, Check, FolderArchive } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/sesmt/equipamentos-moveis_/arquivos-mensais")({
  component: ArquivosMensaisPage,
  head: () => ({ meta: [{ title: "Arquivos Mensais · Equipamentos · SIGMO" }] }),
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Equip = { id: string; tag: string; nome: string; tipo: string; status: string };
type ArquivoRow = {
  id: string;
  equipamento_id: string;
  ano: number;
  mes: number;
  pdf_path: string;
  uploaded_at: string;
};

function ArquivosMensaisPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const equipamentos = useQuery({
    queryKey: ["equipamentos-moveis", "arquivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_moveis")
        .select("id, tag, nome, tipo, status")
        .order("tag");
      if (error) throw error;
      return (data ?? []) as Equip[];
    },
  });

  const arquivos = useQuery({
    queryKey: ["arquivos-legados-mes", year, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_arquivos_legados")
        .select("*")
        .eq("ano", year)
        .eq("mes", mes);
      if (error) throw error;
      return (data ?? []) as ArquivoRow[];
    },
  });

  const byEquip = useMemo(() => {
    const m: Record<string, ArquivoRow> = {};
    for (const a of arquivos.data ?? []) m[a.equipamento_id] = a;
    return m;
  }, [arquivos.data]);

  async function handleUpload(file: File, equipamentoId: string, existing?: ArquivoRow) {
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF acima de 20MB");
      return;
    }
    setBusyId(equipamentoId);
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
      toast.success("PDF salvo");
      qc.invalidateQueries({ queryKey: ["arquivos-legados-mes", year, mes] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setBusyId(null);
    }
  }

  async function handleVer(row: ArquivoRow) {
    const { data, error } = await supabase.storage
      .from("checklists-equipamentos")
      .createSignedUrl(row.pdf_path, 300);
    if (error || !data) { toast.error("Falha ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(row: ArquivoRow) {
    if (!confirm(`Remover PDF de ${MESES[row.mes - 1]}/${row.ano}?`)) return;
    setBusyId(row.equipamento_id);
    try {
      await supabase.storage.from("checklists-equipamentos").remove([row.pdf_path]);
      const { error } = await supabase.from("checklist_arquivos_legados").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("PDF removido");
      qc.invalidateQueries({ queryKey: ["arquivos-legados-mes", year, mes] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao remover");
    } finally {
      setBusyId(null);
    }
  }

  const lista = equipamentos.data ?? [];
  const totalEnviados = lista.filter((e) => byEquip[e.id]).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SESMT · Arquivos Legados</p>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FolderArchive className="h-6 w-6 text-red-700" /> Arquivos Mensais de Checklist
          </h1>
          <p className="text-sm text-slate-500">
            Suba 1 PDF por máquina, por mês. Auditável para ISO 9001.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/sesmt/equipamentos-moveis">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mês</span>
            <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((nome, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ano</span>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-sm text-slate-600">
            <span className="font-black text-emerald-700">{totalEnviados}</span>
            <span className="text-slate-400"> / {lista.length} máquinas enviadas</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          {equipamentos.isLoading && (
            <p className="text-center text-sm text-slate-400 py-6">Carregando equipamentos…</p>
          )}
          {!equipamentos.isLoading && lista.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-6">Nenhum equipamento cadastrado.</p>
          )}
          {lista.map((e) => {
            const row = byEquip[e.id];
            const busy = busyId === e.id;
            return (
              <div
                key={e.id}
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
                  <p className="text-sm font-black text-slate-900 truncate">
                    <span className="font-mono text-red-700 mr-2">{e.tag}</span>
                    {e.nome}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {row
                      ? `${MESES[mes - 1]}/${year} · enviado em ${new Date(row.uploaded_at).toLocaleDateString("pt-BR")}`
                      : `${MESES[mes - 1]}/${year} · nenhum PDF enviado`}
                  </p>
                </div>
                <input
                  ref={(el) => { fileRefs.current[e.id] = el; }}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (f) handleUpload(f, e.id, row);
                    ev.target.value = "";
                  }}
                />
                {row ? (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleVer(row)} title="Ver">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={() => fileRefs.current[e.id]?.click()} title="Substituir">
                      <RotateCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" disabled={busy} onClick={() => handleDelete(row)} title="Remover">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRefs.current[e.id]?.click()}>
                    <Upload className={cn("h-4 w-4 mr-1", busy && "animate-spin")} /> Upload PDF
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
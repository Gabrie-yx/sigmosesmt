import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, FileDown, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dds/historico")({
  component: DDSHistoricoPage,
});

type DDS = {
  id: string; data: string; hora: string | null; setor: string | null;
  gestor_id: string | null; conteudo: string | null;
  participantes_esperados: number; participantes_presentes: number; aderencia: number;
  temas_ids: string[] | null; temas_livres: string[] | null;
};

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DDSHistoricoPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [exporting, setExporting] = useState(false);

  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDateObj = new Date(year, month, 0);
  const toDate = `${year}-${String(month).padStart(2, "0")}-${String(toDateObj.getDate()).padStart(2, "0")}`;

  const { data: dds = [] } = useQuery({
    queryKey: ["dds-historico", year, month],
    queryFn: async () => {
      const { data } = await supabase.from("dds").select("*")
        .gte("data", fromDate).lte("data", toDate)
        .order("data", { ascending: true });
      return (data ?? []) as DDS[];
    },
  });
  const ddsIds = dds.map((d) => d.id);

  const { data: evidencias = [] } = useQuery({
    queryKey: ["dds-evid-month", ddsIds.join(",")],
    enabled: ddsIds.length > 0,
    queryFn: async () =>
      (await supabase.from("dds_evidencias").select("*").in("dds_id", ddsIds)).data ?? [],
  });
  const { data: gestores = [] } = useQuery({
    queryKey: ["dds-gestores-all"],
    queryFn: async () => (await supabase.from("dds_gestores").select("id,nome")).data ?? [],
  });
  const { data: temas = [] } = useQuery({
    queryKey: ["dds-temas-all"],
    queryFn: async () => (await supabase.from("dds_temas").select("id,codigo,titulo")).data ?? [],
  });

  const evidByDds = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const e of evidencias) (m[e.dds_id] ||= []).push(e);
    return m;
  }, [evidencias]);
  const gestorMap = useMemo(() => Object.fromEntries(gestores.map((g: any) => [g.id, g.nome])), [gestores]);
  const temaMap = useMemo(() => Object.fromEntries(temas.map((t: any) => [t.id, t])), [temas]);

  async function abrir(path: string) {
    const { data } = await supabase.storage.from("dds-anexos").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function exportarPdfMes() {
    if (dds.length === 0) return toast.error("Sem DDS no mês selecionado");
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"), import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      // Capa
      doc.setFont("helvetica", "bold").setFontSize(18);
      doc.text("Histórico Mensal de DDS", pageW / 2, 30, { align: "center" });
      doc.setFontSize(14);
      doc.text(`${months[month - 1]}/${year}`, pageW / 2, 40, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(`Total de DDS realizados: ${dds.length}`, pageW / 2, 50, { align: "center" });
      doc.text(`Total de evidências anexadas: ${evidencias.length}`, pageW / 2, 56, { align: "center" });

      // Tabela resumo
      autoTable(doc as any, {
        startY: 70,
        head: [["Data", "Setor", "Gestor", "Esp.", "Pres.", "Aderência", "Anexos"]],
        body: dds.map((d) => [
          new Date(d.data + "T00:00").toLocaleDateString("pt-BR"),
          d.setor ?? "—",
          gestorMap[d.gestor_id ?? ""] ?? "—",
          String(d.participantes_esperados),
          String(d.participantes_presentes),
          `${Number(d.aderencia ?? 0).toFixed(0)}%`,
          String((evidByDds[d.id] ?? []).length),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [153, 27, 27] },
      });

      // Anexar imagens das fichas escaneadas
      for (const d of dds) {
        const evs = (evidByDds[d.id] ?? []).filter((e: any) =>
          /\.(png|jpe?g|webp)$/i.test(e.file_path)
        );
        for (const ev of evs) {
          const { data: signed } = await supabase.storage.from("dds-anexos").createSignedUrl(ev.file_path, 60 * 10);
          if (!signed?.signedUrl) continue;
          try {
            const blob = await (await fetch(signed.signedUrl)).blob();
            const dataUrl: string = await new Promise((r) => {
              const fr = new FileReader();
              fr.onload = () => r(fr.result as string);
              fr.readAsDataURL(blob);
            });
            doc.addPage();
            doc.setFont("helvetica", "bold").setFontSize(11);
            doc.text(
              `DDS de ${new Date(d.data + "T00:00").toLocaleDateString("pt-BR")} — ${d.setor ?? ""}`,
              10, 12,
            );
            const fmt = /\.png$/i.test(ev.file_path) ? "PNG" : "JPEG";
            const maxW = pageW - 20;
            const maxH = doc.internal.pageSize.getHeight() - 25;
            doc.addImage(dataUrl, fmt, 10, 18, maxW, maxH, undefined, "FAST");
          } catch (e) {
            console.warn("Falha ao anexar imagem", ev.file_path, e);
          }
        }
      }

      doc.save(`Historico_DDS_${year}-${String(month).padStart(2, "0")}.pdf`);
      toast.success("PDF do mês gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/dds"><ArrowLeft className="h-4 w-4 mr-1" />DDS</Link></Button>
        <h1 className="text-xl font-bold">Histórico Mensal de DDS</h1>
      </div>

      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs uppercase font-bold text-slate-500">Mês</label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase font-bold text-slate-500">Ano</label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{dds.length} DDS</Badge>
          <Badge variant="secondary">{evidencias.length} anexos</Badge>
          <Button onClick={exportarPdfMes} disabled={exporting || dds.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Exportar PDF do mês
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg divide-y">
        {dds.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum DDS registrado em {months[month - 1]}/{year}</div>
        )}
        {dds.map((d) => {
          const evs = evidByDds[d.id] ?? [];
          const temasNomes = [
            ...(d.temas_ids ?? []).map((id) => {
              const t = temaMap[id];
              return t ? `${t.codigo ? t.codigo + ". " : ""}${t.titulo}` : null;
            }).filter(Boolean),
            ...(d.temas_livres ?? []),
          ];
          return (
            <div key={d.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="text-center min-w-16">
                  <div className="text-xs text-slate-500 uppercase">{months[new Date(d.data + "T00:00").getMonth()]}</div>
                  <div className="text-2xl font-bold">{new Date(d.data + "T00:00").getDate()}</div>
                  <div className="text-xs text-slate-500">{d.hora?.slice(0, 5) ?? ""}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{d.setor ?? "Sem setor"} — {gestorMap[d.gestor_id ?? ""] ?? "Sem gestor"}</div>
                  <div className="text-xs text-slate-600 truncate">{temasNomes.join(" / ") || "—"}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Presentes: <b>{d.participantes_presentes}</b>/{d.participantes_esperados} • Aderência: <b>{Number(d.aderencia ?? 0).toFixed(0)}%</b>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={evs.length > 0 ? "default" : "outline"}>
                    <Paperclip className="h-3 w-3 mr-1" />{evs.length}
                  </Badge>
                </div>
              </div>
              {evs.length > 0 && (
                <div className="mt-2 pl-20 flex flex-wrap gap-1">
                  {evs.map((e: any) => (
                    <button key={e.id} onClick={() => abrir(e.file_path)}
                      className="text-xs px-2 py-1 border rounded hover:bg-slate-50 flex items-center gap-1">
                      <FileText className="h-3 w-3" />{e.descricao ?? e.file_path.split("/").pop()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, FileText, Filter, MoreHorizontal, Printer, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { AprForm } from "@/components/aprs/apr-form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { abrirAprPdf, imprimirAprPdf, baixarAprPdf } from "@/lib/apr-pdf-loader";
import { DEFAULT_TEXTO_GERAIS } from "@/lib/apr-defaults";

export const Route = createFileRoute("/app/aprs")({
  component: AprsPage,
});

const STATUS_TONE: Record<string, string> = {
  RASCUNHO: "bg-slate-200 text-slate-700",
  ATIVA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ENCERRADA: "bg-slate-100 text-slate-600",
  CANCELADA: "bg-rose-100 text-rose-700",
};

const newAprDraft = {
  atividade_descricao: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  validade_dias: 7,
  status: "RASCUNHO",
  exige_pte: false,
  texto_gerais: DEFAULT_TEXTO_GERAIS,
  hora_inicio: "07:30",
  hora_fim: "17:30",
  hora_inicio_sexta: "07:30",
  hora_fim_sexta: "16:30",
  dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"],
};

function AprsPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<string | null | "new">(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCasco, setFilterCasco] = useState<string>("ALL");

  const { data: aprs = [], isLoading } = useQuery({
    queryKey: ["aprs"],
    queryFn: async () => (await supabase.from("aprs").select("*").order("data_emissao", { ascending: false }).order("numero", { ascending: false })).data ?? [],
  });
  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-light-list"],
    queryFn: async () => (await supabase.from("cascos").select("id,numero,nome").order("numero")).data ?? [],
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-light-aprs"],
    queryFn: async () => (await supabase.from("companies").select("id,name")).data ?? [],
  });

  const cascoMap = useMemo(() => new Map(cascos.map((c: any) => [c.id, c])), [cascos]);
  const companyMap = useMemo(() => new Map(companies.map((c: any) => [c.id, c.name])), [companies]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return aprs.filter((a: any) => {
      if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      if (filterCasco !== "ALL" && a.casco_id !== filterCasco) return false;
      if (search) {
        const q = search.toLowerCase();
        const txt = `${a.numero ?? ""} ${a.atividade_descricao ?? ""} ${a.local ?? ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    }).map((a: any) => ({
      ...a,
      _vencida: a.data_validade && a.data_validade < today && a.status === "ATIVA",
    }));
  }, [aprs, search, filterStatus, filterCasco]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aprs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aprs"] }); toast.success("APR excluída"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-[#991b1b] flex items-center gap-2">
            <FileText className="h-7 w-7" /> APR — Análise Preliminar de Risco
          </h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} APR(s) listadas</p>
        </div>
        {isEditor && (
          <Button
            onClick={() => {
              qc.setQueryData(["apr-form-draft", "new"], newAprDraft);
              setEditing("new");
            }}
            size="lg"
            className="bg-[#991b1b] hover:bg-[#7f1d1d]"
          >
            <Plus className="h-4 w-4 mr-1" /> Nova APR
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 shrink-0">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar por número, atividade, local..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="ATIVA">Ativa</SelectItem>
            <SelectItem value="ENCERRADA">Encerrada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCasco} onValueChange={setFilterCasco}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos cascos</SelectItem>
            {cascos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.numero}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Casco</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Carregando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-400">Nenhuma APR encontrada</TableCell></TableRow>
              ) : filtered.map((a: any) => {
                const casco = a.casco_id ? cascoMap.get(a.casco_id) as any : null;
                return (
                  <TableRow key={a.id} className={a._vencida ? "bg-rose-50/50" : ""}>
                    <TableCell className="font-bold text-[#991b1b]">{a.numero}</TableCell>
                    <TableCell className="text-sm">{formatDateBR(a.data_emissao)}</TableCell>
                    <TableCell className="text-sm">{casco ? casco.numero : "—"}</TableCell>
                    <TableCell className="text-sm">{a.empresa_id ? companyMap.get(a.empresa_id) ?? "—" : "—"}</TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate" title={a.atividade_descricao}>{a.atividade_descricao}</TableCell>
                    <TableCell className="text-sm">
                      {a.data_validade ? formatDateBR(a.data_validade) : "—"}
                      {a._vencida && <Badge variant="destructive" className="ml-1 text-[9px]">VENCIDA</Badge>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_TONE[a.status] ?? ""}`}>{a.status}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => abrirAprPdf(a.id).catch((e) => toast.error(e.message))}>
                            <Eye className="h-4 w-4 mr-2" /> Visualizar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => imprimirAprPdf(a.id).catch((e) => toast.error(e.message))}>
                            <Printer className="h-4 w-4 mr-2" /> Imprimir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => baixarAprPdf(a.id, a.numero).catch((e) => toast.error(e.message))}>
                            <Download className="h-4 w-4 mr-2" /> Baixar PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isEditor && (
                            <DropdownMenuItem onClick={() => setEditing(a.id)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={() => { if (confirm(`Excluir ${a.numero}?`)) del.mutate(a.id); }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>{editing === "new" ? "Nova APR" : "Editar APR"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <AprForm key={editing ?? "closed"} aprId={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
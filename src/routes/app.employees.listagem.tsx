import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Eye, Printer } from "lucide-react";
import { gerarPdfListagemFuncionarios } from "@/lib/employees-listagem-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/employees/listagem")({
  component: ListagemFuncionariosPage,
});

function ListagemFuncionariosPage() {
  const [companyFilter, setCompanyFilter] = useState<string>("TODAS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ATIVO" | "INATIVO" | "AFASTADO" | "DESLIGADO">("ATIVO");
  const [preview, setPreview] = useState<{ doc: jsPDF; fileName: string } | null>(null);

  const { data: emps, isLoading } = useQuery({
    queryKey: ["employees-listagem"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [],
  });

  const cMap = useMemo(() => new Map((companies ?? []).map((c: any) => [c.id, c.name])), [companies]);
  const rMap = useMemo(() => new Map((roles ?? []).map((r: any) => [r.id, r.name])), [roles]);

  const filtered = useMemo(() => {
    return (emps ?? []).filter((e: any) => {
      if (statusFilter !== "TODOS" && e.status !== statusFilter) return false;
      if (companyFilter !== "TODAS" && e.company_id !== companyFilter) return false;
      return true;
    });
  }, [emps, statusFilter, companyFilter]);

  const empresaLabel = companyFilter === "TODAS"
    ? "Todas as empresas"
    : (cMap.get(companyFilter) ?? "—");
  const statusLabel = statusFilter === "TODOS" ? "Todos" : statusFilter;

  function buildDoc() {
    return gerarPdfListagemFuncionarios(filtered, cMap as Map<string, string>, rMap as Map<string, string>, {
      empresaLabel,
      statusLabel,
    });
  }

  function handlePreview() {
    const doc = buildDoc();
    const safeEmpresa = empresaLabel.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 40);
    const today = new Date().toISOString().slice(0, 10);
    setPreview({ doc, fileName: `listagem-funcionarios_${safeEmpresa}_${today}.pdf` });
  }

  function handleDownload() {
    const doc = buildDoc();
    const safeEmpresa = empresaLabel.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 40);
    const today = new Date().toISOString().slice(0, 10);
    doc.save(`listagem-funcionarios_${safeEmpresa}_${today}.pdf`);
  }

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <Link to="/app/employees">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="heading-display text-3xl md:text-4xl text-brand">Listagem de funcionários</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
              Gerar PDF para impressão ou download
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!filtered.length}
            className="text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto"
          >
            <Eye className="h-4 w-4 mr-2" />Prévia PDF
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!filtered.length}
            className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg"
          >
            <FileText className="h-4 w-4 mr-2" />Gerar PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
        <div className="md:col-span-5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Empresa</label>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as empresas</SelectItem>
              {(companies ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-12 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="ATIVO">Ativos</SelectItem>
              <SelectItem value="AFASTADO">Afastados</SelectItem>
              <SelectItem value="INATIVO">Inativos</SelectItem>
              <SelectItem value="DESLIGADO">Desligados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3 flex items-end">
          <div className="w-full rounded-2xl bg-[#7B1E2B]/5 ring-1 ring-[#7B1E2B]/20 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#7B1E2B]">Total filtrado</p>
            <p className="text-2xl font-black text-[#7B1E2B] leading-none mt-1">{filtered.length}</p>
          </div>
        </div>
      </div>

      {/* Prévia tabela */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Matrícula</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Nome</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">CPF</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Cargo</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Empresa</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Nenhum funcionário encontrado.</td></tr>
              ) : (
                filtered.map((e: any, i: number) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{String(i + 1).padStart(3, "0")}</td>
                    <td className="px-3 py-2 tabular-nums">{e.matricula ?? "—"}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{e.nome}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{e.cpf ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{rMap.get(e.role_id) ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{cMap.get(e.company_id) ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ${
                        e.status === "ATIVO" ? "bg-emerald-100 text-emerald-700 ring-emerald-200" :
                        e.status === "AFASTADO" ? "bg-amber-100 text-amber-700 ring-amber-200" :
                        e.status === "DESLIGADO" ? "bg-slate-200 text-slate-700 ring-slate-300" :
                        "bg-rose-100 text-rose-700 ring-rose-200"
                      }`}>{e.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
        <Printer className="h-3 w-3" />
        O PDF é gerado a partir do filtro acima — ordem alfabética por nome
      </p>

      <PDFPreviewDialog
        open={!!preview}
        onClose={() => setPreview(null)}
        doc={preview?.doc ?? null}
        fileName={preview?.fileName ?? "listagem.pdf"}
        title="Listagem de funcionários"
      />
    </div>
  );
}
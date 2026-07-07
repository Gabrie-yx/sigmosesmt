import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileDown, FileText, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatDateBR } from "@/lib/utils-date";
import { maskCPF } from "@/lib/masks";
import { toast } from "sonner";
import { printPdf } from "@/lib/pdf-print";
import { drawPdfHeader } from "@/lib/pdf-header";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/app/employees/relatorio-admissoes")({
  component: RelatorioAdmissoes,
});

function RelatorioAdmissoes() {
  const { isAdmin, isModerator } = useAuth();
  const canView = isAdmin || isModerator;

  // Defaults: últimos 30 dias
  const today = new Date();
  const past = new Date(); past.setDate(past.getDate() - 30);
  const [de, setDe] = useState(past.toISOString().slice(0, 10));
  const [ate, setAte] = useState(today.toISOString().slice(0, 10));
  const [companyId, setCompanyId] = useState<string>("__all__");
  const [tipo, setTipo] = useState<string>("__all__");

  const { data: companies } = useQuery({
    queryKey: ["rel-adm-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: roles } = useQuery({
    queryKey: ["rel-adm-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: rows, isFetching } = useQuery({
    queryKey: ["rel-admissoes", de, ate, companyId, tipo],
    enabled: canView && !!de && !!ate,
    queryFn: async () => {
      let q = supabase
        .from("employees")
        .select("id, nome, cpf, admissao, tipo_cadastro, company_id, role_id, status")
        .gte("admissao", de)
        .lte("admissao", ate)
        .order("admissao", { ascending: false });
      if (companyId !== "__all__") q = q.eq("company_id", companyId);
      if (tipo !== "__all__") q = q.eq("tipo_cadastro", tipo);
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const empresaNome = (id: string | null) => (companies ?? []).find((c: any) => c.id === id)?.name ?? "—";
  const roleNome = (id: string | null) => (roles ?? []).find((r: any) => r.id === id)?.name ?? "—";

  const linhas = useMemo(() =>
    (rows ?? []).map((r: any) => ({
      nome: r.nome ?? "",
      cpf: r.cpf ?? "",
      funcao: roleNome(r.role_id),
      empresa: empresaNome(r.company_id),
      tipo: r.tipo_cadastro ?? "",
      admissao: r.admissao ?? "",
    })),
    [rows, companies, roles]
  );

  function exportCsv() {
    if (linhas.length === 0) { toast.error("Nada para exportar"); return; }
    const header = ["Nome", "CPF", "Função", "Empresa", "Tipo Cadastro", "Data Admissão"];
    const csv = [header, ...linhas.map((l) => [
      l.nome, l.cpf, l.funcao, l.empresa, l.tipo, l.admissao ? formatDateBR(l.admissao) : "",
    ])].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-admissoes-${de}-a-${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    if (linhas.length === 0) { toast.error("Nada para exportar"); return; }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const startY = drawPdfHeader(doc, {
      titulo: "Relatório de Admissões de Funcionários",
      subtitulo: `Período: ${formatDateBR(de)} a ${formatDateBR(ate)}${
        companyId !== "__all__" ? ` · Empresa: ${empresaNome(companyId)}` : ""
      }${tipo !== "__all__" ? ` · Tipo: ${tipo}` : ""}`,
      destaque: `${linhas.length} funcionário(s)`,
    });
    autoTable(doc, {
      startY: startY + 2,
      head: [["Nome", "CPF", "Função", "Empresa", "Tipo", "Admissão"]],
      body: linhas.map((l) => [l.nome, l.cpf, l.funcao, l.empresa, l.tipo, l.admissao ? formatDateBR(l.admissao) : ""]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [153, 27, 27] },
    });
    const blob = doc.output("blob");
    await printPdf(await blob.arrayBuffer(), `Relatorio-Admissoes-${de}-a-${ate}.pdf`);
  }

  if (!canView) {
    return (
      <div className="p-6">
        <Card className="p-6"><p className="text-sm">Acesso restrito a administradores e moderadores.</p></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-xl font-bold">Relatório de Admissões</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/employees"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <FileDown className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Data admissão (de) *</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <Label>Data admissão (até) *</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div>
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {(companies ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo Cadastro</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="CLT">CLT</SelectItem>
                <SelectItem value="AVULSO">AVULSO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-2 md:p-4">
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{isFetching ? "Buscando…" : `${linhas.length} funcionário(s)`}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Admissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum registro no período/filtro selecionado.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    <Link to="/app/employees/$id" params={{ id: (rows ?? [])[i].id }} className="hover:underline">
                      {l.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{maskCPF(l.cpf)}</TableCell>
                  <TableCell>{l.funcao}</TableCell>
                  <TableCell>{l.empresa}</TableCell>
                  <TableCell><Badge variant="secondary">{l.tipo}</Badge></TableCell>
                  <TableCell>{l.admissao ? formatDateBR(l.admissao) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
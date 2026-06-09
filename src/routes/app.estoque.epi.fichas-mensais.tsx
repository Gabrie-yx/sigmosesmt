import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Upload, Printer, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { openFichaMensalPdf, type FichaMensalBlock } from "@/lib/epi-ficha-mensal-pdf";

export const Route = createFileRoute("/app/estoque/epi/fichas-mensais")({
  component: FichasMensaisPage,
});

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type Row = {
  employee_id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  funcao: string | null;
  empresa: string | null;
  ano: number;
  mes: number;
  total: number;
  ficha_id: string | null;
  status: "PENDENTE" | "ASSINADA";
  arquivo_path: string | null;
};

function periodoKey(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function FichasMensaisPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendente" | "assinada">("pendente");
  const [filterTexto, setFilterTexto] = useState("");

  // Carrega entregas + funcionários + fichas existentes
  const { data, isLoading } = useQuery({
    queryKey: ["fichas-mensais-base"],
    queryFn: async () => {
      const [entregasRes, empsRes, fichasRes, compsRes, rolesRes] = await Promise.all([
        supabase.from("epi_deliveries").select("employee_id, data_entrega").limit(20000),
        supabase.from("employees").select("id, nome, matricula, cpf, funcao, role_id, company_id"),
        supabase.from("epi_fichas_mensais").select("*"),
        supabase.from("companies").select("id, name"),
        supabase.from("roles").select("id, name"),
      ]);
      if (entregasRes.error) throw entregasRes.error;
      if (empsRes.error) throw empsRes.error;
      if (fichasRes.error) throw fichasRes.error;
      return {
        entregas: entregasRes.data ?? [],
        emps: empsRes.data ?? [],
        fichas: fichasRes.data ?? [],
        comps: compsRes.data ?? [],
        roles: rolesRes.data ?? [],
      };
    },
  });

  // Monta a grade (employee × mes) só para meses já encerrados (não inclui o mês atual incompleto)
  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const empMap = new Map(data.emps.map((e: any) => [e.id, e]));
    const compMap = new Map(data.comps.map((c: any) => [c.id, c.name]));
    const roleMap = new Map(data.roles.map((r: any) => [r.id, r.name]));
    const fichasMap = new Map(
      data.fichas.map((f: any) => [`${f.employee_id}_${f.ano}_${f.mes}`, f]),
    );

    // Agrupa entregas por (emp, ano, mes)
    const buckets = new Map<string, { emp_id: string; ano: number; mes: number; total: number }>();
    const now = new Date();
    const curYM = now.getFullYear() * 12 + now.getMonth(); // mês atual = não conta

    for (const e of data.entregas as any[]) {
      if (!e.data_entrega) continue;
      const d = new Date(e.data_entrega);
      if (isNaN(d.getTime())) continue;
      const ym = d.getFullYear() * 12 + d.getMonth();
      if (ym >= curYM) continue; // mês atual ainda em curso
      const key = `${e.employee_id}_${d.getFullYear()}_${d.getMonth() + 1}`;
      const b = buckets.get(key);
      if (b) b.total++;
      else buckets.set(key, { emp_id: e.employee_id, ano: d.getFullYear(), mes: d.getMonth() + 1, total: 1 });
    }

    const result: Row[] = [];
    buckets.forEach((b) => {
      const emp: any = empMap.get(b.emp_id);
      if (!emp) return;
      const ficha = fichasMap.get(`${b.emp_id}_${b.ano}_${b.mes}`);
      result.push({
        employee_id: b.emp_id,
        nome: emp.nome,
        matricula: emp.matricula,
        cpf: emp.cpf,
        funcao: roleMap.get(emp.role_id) ?? null,
        empresa: compMap.get(emp.company_id) ?? null,
        ano: b.ano,
        mes: b.mes,
        total: b.total,
        ficha_id: ficha?.id ?? null,
        status: ficha?.arquivo_assinado_path ? "ASSINADA" : "PENDENTE",
        arquivo_path: ficha?.arquivo_assinado_path ?? null,
      });
    });

    result.sort((a, b) => {
      const k1 = periodoKey(b.ano, b.mes).localeCompare(periodoKey(a.ano, a.mes));
      if (k1 !== 0) return k1;
      return a.nome.localeCompare(b.nome);
    });
    return result;
  }, [data]);

  const filtered = useMemo(() => {
    const t = filterTexto.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus === "pendente" && r.status !== "PENDENTE") return false;
      if (filterStatus === "assinada" && r.status !== "ASSINADA") return false;
      if (t && !`${r.nome} ${r.matricula ?? ""} ${r.empresa ?? ""}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [rows, filterStatus, filterTexto]);

  const pendentesCount = rows.filter((r) => r.status === "PENDENTE").length;
  const assinadasCount = rows.filter((r) => r.status === "ASSINADA").length;

  // Buscar entregas detalhadas (sob demanda) e montar bloco
  async function montarBloco(r: Row): Promise<FichaMensalBlock> {
    const first = new Date(r.ano, r.mes - 1, 1).toISOString().slice(0, 10);
    const last = new Date(r.ano, r.mes, 0).toISOString().slice(0, 10);
    const { data: ents, error } = await supabase
      .from("epi_deliveries")
      .select("qtd, item, tamanho, ca, data_entrega, motivo_entrega")
      .eq("employee_id", r.employee_id)
      .gte("data_entrega", first)
      .lte("data_entrega", last)
      .order("data_entrega");
    if (error) throw error;
    return {
      employee: {
        id: r.employee_id,
        nome: r.nome,
        matricula: r.matricula,
        cpf: r.cpf,
        funcao: r.funcao,
        empresa: r.empresa,
      },
      ano: r.ano,
      mes: r.mes,
      entregas: ents ?? [],
    };
  }

  const gerarUma = useMutation({
    mutationFn: async (r: Row) => {
      const block = await montarBloco(r);
      const { url, filename } = openFichaMensalPdf(
        [block],
        `Ficha_${r.nome.replace(/\s+/g, "_")}_${r.ano}-${String(r.mes).padStart(2, "0")}.pdf`,
      );
      window.open(url, "_blank");
      // garante registro PENDENTE
      if (!r.ficha_id) {
        await supabase.from("epi_fichas_mensais").upsert({
          employee_id: r.employee_id,
          ano: r.ano,
          mes: r.mes,
          total_entregas: r.total,
          status: "PENDENTE",
        }, { onConflict: "employee_id,ano,mes" });
      }
      return filename;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas-mensais-base"] });
      toast.success("Ficha gerada — abra a janela do PDF para imprimir.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar ficha"),
  });

  const gerarTodasPendentes = useMutation({
    mutationFn: async () => {
      const pend = rows.filter((r) => r.status === "PENDENTE");
      if (!pend.length) throw new Error("Nenhuma ficha pendente");
      toast.info(`Montando ${pend.length} fichas em um PDF único…`);
      const blocks: FichaMensalBlock[] = [];
      for (const r of pend) blocks.push(await montarBloco(r));
      const { url, filename } = openFichaMensalPdf(blocks, `Fichas_Mensais_EPI_Pendentes.pdf`);
      window.open(url, "_blank");
      // upsert pendentes em lote
      const payload = pend.map((r) => ({
        employee_id: r.employee_id,
        ano: r.ano,
        mes: r.mes,
        total_entregas: r.total,
        status: "PENDENTE",
      }));
      await supabase.from("epi_fichas_mensais").upsert(payload, { onConflict: "employee_id,ano,mes" });
      return filename;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas-mensais-base"] });
      toast.success("PDF gigante gerado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar"),
  });

  async function uploadAssinada(r: Row, file: File) {
    if (!isEditor) {
      toast.error("Sem permissão");
      return;
    }
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${r.employee_id}/${r.ano}-${String(r.mes).padStart(2, "0")}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("epi-fichas-mensais")
        .upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("epi_fichas_mensais").upsert(
        {
          employee_id: r.employee_id,
          ano: r.ano,
          mes: r.mes,
          total_entregas: r.total,
          status: "ASSINADA",
          arquivo_assinado_path: path,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,ano,mes" },
      );
      if (dbErr) throw dbErr;
      toast.success(`Ficha assinada de ${r.nome} — ${MESES[r.mes - 1]}/${r.ano} anexada.`);
      qc.invalidateQueries({ queryKey: ["fichas-mensais-base"] });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes("bucket")) {
        toast.error("Bucket 'epi-fichas-mensais' ainda não existe. Crie no painel do Supabase (Storage).", { duration: 10000 });
      } else {
        toast.error(msg);
      }
    }
  }

  async function baixarAssinada(r: Row) {
    if (!r.arquivo_path) return;
    const { data, error } = await supabase.storage.from("epi-fichas-mensais").createSignedUrl(r.arquivo_path, 300);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="p-6 md:p-8 space-y-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/estoque/epi"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Estoque EPI</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fichas Mensais de EPI</h1>
        <p className="text-sm text-muted-foreground">
          Substitua a assinatura por entrega. Gere uma ficha consolidada por funcionário/mês, colha a assinatura única do colaborador e faça o upload — auditor enxerga o lançamento eletrônico + a folha assinada (NR-06 ✓).
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Fichas pendentes</p>
              <p className="text-2xl font-bold">{pendentesCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Fichas assinadas</p>
              <p className="text-2xl font-bold">{assinadasCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Imprimir todas as pendentes</p>
            <p className="text-[11px] text-muted-foreground">1 PDF único, separado por funcionário/mês</p>
          </div>
          <Button
            size="sm"
            disabled={!pendentesCount || gerarTodasPendentes.isPending}
            onClick={() => gerarTodasPendentes.mutate()}
          >
            <Printer className="h-4 w-4 mr-1" />
            {gerarTodasPendentes.isPending ? "Montando…" : "Gerar PDF gigante"}
          </Button>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome, matrícula ou empresa…"
          value={filterTexto}
          onChange={(e) => setFilterTexto(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Apenas pendentes</SelectItem>
            <SelectItem value="assinada">Apenas assinadas</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} linha(s) • mês atual não é listado (ainda em curso)
        </p>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-center">Entregas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Nenhuma ficha {filterStatus === "pendente" ? "pendente" : ""} encontrada.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={`${r.employee_id}_${r.ano}_${r.mes}`}>
                <TableCell className="font-mono text-xs">{MESES[r.mes - 1]}/{r.ano}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-xs">{r.matricula ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.empresa ?? "—"}</TableCell>
                <TableCell className="text-center">{r.total}</TableCell>
                <TableCell>
                  {r.status === "ASSINADA" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Assinada</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => gerarUma.mutate(r)} disabled={gerarUma.isPending}>
                      <FileText className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    {r.status === "ASSINADA" && (
                      <Button size="sm" variant="ghost" onClick={() => baixarAssinada(r)}>
                        <Download className="h-4 w-4 mr-1" /> Baixar assinada
                      </Button>
                    )}
                    {isEditor && (
                      <label className="inline-flex">
                        <Button size="sm" variant="outline" asChild>
                          <span className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-1" />
                            {r.status === "ASSINADA" ? "Substituir" : "Anexar assinada"}
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadAssinada(r, f);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
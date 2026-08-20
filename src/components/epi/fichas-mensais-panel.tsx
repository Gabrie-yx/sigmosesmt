import { Link } from "@tanstack/react-router";
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
import { ArrowLeft, FileText, Upload, Printer, CheckCircle2, AlertTriangle, Download, FileSignature } from "lucide-react";
import { buildEpiFichaPdf } from "@/lib/epi-ficha-pdf";
import { buildFichaOficialBytes, bytesToPreviewDoc } from "@/lib/epi-ficha-oficial";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { lazy, Suspense } from "react";
const PdfSignerDialog = lazy(() =>
  import("@/components/pdf-signer-dialog").then((m) => ({ default: m.PdfSignerDialog }))
);

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type Row = {
  employee_id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  admissao: string | null;
  funcao: string | null;
  empresa: string | null;
  role: any;
  company: any;
  emp: any;
  ano: number;
  mes: number;
  total: number;
  ficha_id: string | null;
  status: "PENDENTE" | "ASSINADA";
  arquivo_path: string | null;
  arquivo_bucket?: "epi-fichas-mensais" | "sesmt-docs" | null;
  desatualizada?: boolean;
  ultimaMovimentacao?: number;
  assinadaEm?: number;
};

function periodoKey(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function FichasMensaisPanel({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendente" | "assinada">("todos");
  const [filterTexto, setFilterTexto] = useState("");
  const now = new Date();
  const [filterAno, setFilterAno] = useState<number>(now.getFullYear());
  const [filterMes, setFilterMes] = useState<number | "todos">(now.getMonth() + 1);

  const [signer, setSigner] = useState<{ bytes: Uint8Array; name: string; row: Row } | null>(null);
  const [preview, setPreview] = useState<{ doc: any; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fichas-mensais-base"],
    queryFn: async () => {
      const [entregasRes, empsRes, fichasRes, compsRes, rolesRes, docsRes] = await Promise.all([
        supabase.from("epi_deliveries").select("employee_id, data_entrega").limit(20000),
        supabase.from("employees").select("id, nome, matricula, cpf, funcao, role_id, company_id, admissao, assinatura_url"),
        supabase.from("epi_fichas_mensais").select("*"),
        supabase.from("companies").select("id, name"),
        supabase.from("roles").select("id, name"),
        supabase
          .from("documentos_assinados")
          .select("referencia_id, pdf_assinado_path, updated_at, created_at")
          .eq("modulo", "ficha-epi-mensal")
          .order("updated_at", { ascending: false }),
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
        docs: docsRes.data ?? [],
      };
    },
  });

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const empMap = new Map(data.emps.map((e: any) => [e.id, e]));
    const compMap = new Map(data.comps.map((c: any) => [c.id, c]));
    const roleMap = new Map(data.roles.map((r: any) => [r.id, r]));
    const fichasMap = new Map(
      data.fichas.map((f: any) => [`${f.employee_id}_${f.ano}_${f.mes}`, f]),
    );
    // Documentos assinados (fonte de verdade: PdfSignerDialog grava aqui)
    const docsMap = new Map<string, any>();
    for (const d of data.docs as any[]) {
      if (!d.referencia_id) continue;
      if (!docsMap.has(d.referencia_id)) docsMap.set(d.referencia_id, d);
    }

    const buckets = new Map<string, { emp_id: string; ano: number; mes: number; total: number; ultima: number }>();
    for (const e of data.entregas as any[]) {
      if (!e.data_entrega) continue;
      const d = new Date(e.data_entrega);
      if (isNaN(d.getTime())) continue;
      const key = `${e.employee_id}_${d.getFullYear()}_${d.getMonth() + 1}`;
      const t = d.getTime();
      const b = buckets.get(key);
      if (b) { b.total++; if (t > b.ultima) b.ultima = t; }
      else buckets.set(key, { emp_id: e.employee_id, ano: d.getFullYear(), mes: d.getMonth() + 1, total: 1, ultima: t });
    }

    const result: Row[] = [];
    buckets.forEach((b) => {
      const emp: any = empMap.get(b.emp_id);
      if (!emp) return;
      const company: any = compMap.get(emp.company_id) ?? null;
      const role: any = roleMap.get(emp.role_id) ?? null;
      const ficha = fichasMap.get(`${b.emp_id}_${b.ano}_${b.mes}`);
      const refKey = `${b.emp_id}_${b.ano}_${b.mes}`;
      const doc = docsMap.get(refKey);
      const assinadoPath = ficha?.arquivo_assinado_path ?? doc?.pdf_assinado_path ?? null;
      const assinadoBucket = ficha?.arquivo_assinado_path ? "epi-fichas-mensais" : (doc ? "sesmt-docs" : null);
      const assinadaEm = doc ? new Date(doc.updated_at ?? doc.created_at ?? 0).getTime() : 0;
      const desatualizada = !!assinadoPath && assinadaEm > 0 && b.ultima > assinadaEm;
      result.push({
        employee_id: b.emp_id,
        nome: emp.nome,
        matricula: emp.matricula,
        cpf: emp.cpf,
        admissao: emp.admissao ?? null,
        funcao: role?.name ?? emp.funcao ?? null,
        empresa: company?.name ?? null,
        role, company, emp,
        ano: b.ano, mes: b.mes, total: b.total,
        ficha_id: ficha?.id ?? null,
        status: assinadoPath ? "ASSINADA" : "PENDENTE",
        arquivo_path: assinadoPath,
        arquivo_bucket: assinadoBucket,
        desatualizada,
        ultimaMovimentacao: b.ultima,
        assinadaEm,
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
      if (r.ano !== filterAno) return false;
      if (filterMes !== "todos" && r.mes !== filterMes) return false;
      if (t && !`${r.nome} ${r.funcao ?? ""} ${r.empresa ?? ""}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [rows, filterStatus, filterTexto, filterAno, filterMes]);

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    rows.forEach((r) => set.add(r.ano));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  async function buscarEntregas(r: Row) {
    const first = new Date(r.ano, r.mes - 1, 1).toISOString().slice(0, 10);
    const last = new Date(r.ano, r.mes, 0).toISOString().slice(0, 10);
    const { data: ents, error } = await supabase
      .from("epi_deliveries")
      .select("qtd, item, tamanho, ca, data_entrega, data_devolucao, observacoes, assinatura_snapshot, assinatura_data")
      .eq("employee_id", r.employee_id)
      .gte("data_entrega", first)
      .lte("data_entrega", last)
      .order("data_entrega");
    if (error) throw error;
    return ents ?? [];
  }

  /** Gera a ficha no PDF-mãe homologado (FOR-SEG 02); cai no modelo desenhado se o template faltar. */
  async function gerarBytes(r: Row) {
    const epis = await buscarEntregas(r);
    try {
      return await buildFichaOficialBytes([
        {
          emp: {
            nome: r.nome,
            matricula: r.matricula,
            cpf: r.cpf,
            funcao: r.funcao,
            empresa: r.empresa,
            admissao: r.admissao,
          },
          entregas: epis as any[],
          localData: `Belém, ${new Date().toLocaleDateString("pt-BR")}`,
          assinaturaEmpregado: (r.emp as any)?.assinatura_url ?? null,
        },
      ]);
    } catch (e: any) {
      toast.warning("Template homologado indisponível — gerando no modelo interno.");
      const doc = buildEpiFichaPdf({
        emp: { nome: r.nome, cpf: r.cpf, admissao: r.admissao, matricula: r.matricula },
        company: r.company, role: r.role, epis,
      });
      return new Uint8Array(doc.output("arraybuffer"));
    }
  }

  function nomeArquivo(r: Row) {
    return `Ficha_EPI_${r.nome.replace(/\s+/g, "_")}_${r.ano}-${String(r.mes).padStart(2, "0")}.pdf`;
  }

  const baixarPdf = useMutation({
    mutationFn: async (r: Row) => {
      // Visualização/impressão SEMPRE no modelo homologado FOR-SEG 02.
      if (r.arquivo_path && r.desatualizada) {
        toast.info("Ficha assinada está desatualizada (novas entregas no mês). Gerando ficha atualizada — assine novamente.");
      }
      const bytes = await gerarBytes(r);
      setPreview({ doc: bytesToPreviewDoc(bytes, nomeArquivo(r)), name: nomeArquivo(r) });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar PDF"),
  });

  /** Abre o arquivo assinado original (modelo antigo), preservado para auditoria. */
  const abrirOriginal = useMutation({
    mutationFn: async (r: Row) => {
      if (!r.arquivo_path) return;
      const bucket = r.arquivo_bucket ?? "epi-fichas-mensais";
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(r.arquivo_path, 300);
      if (error) throw error;
      const bytes = new Uint8Array(await (await fetch(data.signedUrl)).arrayBuffer());
      const name = `Assinada_${nomeArquivo(r)}`;
      setPreview({ doc: bytesToPreviewDoc(bytes, name), name });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao abrir ficha assinada"),
  });

  const abrirAssinador = useMutation({
    mutationFn: async (r: Row) => {
      const epis = await buscarEntregas(r);
      if (!epis.length) throw new Error("Sem entregas nesse mês — nada a assinar.");
      const bytes = await gerarBytes(r);
      setSigner({ bytes, name: nomeArquivo(r), row: r });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  async function onSigned(info: { path: string; signedBytes: Uint8Array }) {
    if (!signer) return;
    // O PdfSignerDialog já fez o upload em sesmt-docs e gravou em documentos_assinados.
    // Só precisamos atualizar a UI.
    qc.invalidateQueries({ queryKey: ["fichas-mensais-base"] });
    setSigner(null);
  }

  return (
    <div className={embedded ? "space-y-4" : "p-6 md:p-8 space-y-5 animate-fadeIn"}>
      {!embedded && (
        <>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/estoque/epi"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Estoque EPI</Link>
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fichas Mensais de EPI</h1>
            <p className="text-sm text-muted-foreground">
              Ficha consolidada mensal por funcionário no modelo homologado (FOR-SEG 02).
            </p>
          </div>
        </>
      )}

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar nome, função ou empresa…"
          value={filterTexto}
          onChange={(e) => setFilterTexto(e.target.value)}
          className="max-w-sm"
        />
        <Select value={String(filterAno)} onValueChange={(v) => setFilterAno(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(filterMes)} onValueChange={(v) => setFilterMes(v === "todos" ? "todos" : Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {MESES.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pendente">Apenas pendentes</SelectItem>
            <SelectItem value="assinada">Apenas assinadas</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} linha(s)</p>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Função</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Nenhuma ficha encontrada nesse período.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={`${r.employee_id}_${r.ano}_${r.mes}`}>
                <TableCell className="font-mono text-xs">{MESES[r.mes - 1]}/{r.ano}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="text-xs">{r.funcao ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.empresa ?? "—"}</TableCell>
                <TableCell className="text-center">{r.total}</TableCell>
                <TableCell>
                  {r.status === "ASSINADA" ? (
                    r.desatualizada ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Assinada (desatualizada — reassinar)</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Assinada (homologada)</Badge>
                    )
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isEditor && (r.status !== "ASSINADA" || r.desatualizada) && (
                      <Button size="sm" variant="default" onClick={() => abrirAssinador.mutate(r)} disabled={abrirAssinador.isPending}>
                        <FileSignature className="h-4 w-4 mr-1" /> {r.desatualizada ? "Reassinar" : "Assinar"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => baixarPdf.mutate(r)} disabled={baixarPdf.isPending}>
                      <Printer className="h-4 w-4 mr-1" /> Ver FOR-SEG 02
                    </Button>
                    {r.arquivo_path && (
                      <Button size="sm" variant="ghost" onClick={() => abrirOriginal.mutate(r)} disabled={abrirOriginal.isPending} title="Arquivo assinado original">
                        <Download className="h-4 w-4 mr-1" /> Assinada
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {signer && (
        <>
        <Suspense fallback={null}>
          <PdfSignerDialog
            open={!!signer}
            onClose={() => setSigner(null)}
            source={signer?.bytes ?? null}
            nomeArquivo={signer?.name ?? "ficha-epi.pdf"}
            modulo="ficha-epi-mensal"
            referenciaId={signer ? `${signer.row.employee_id}_${signer.row.ano}_${signer.row.mes}` : undefined}
            onSigned={onSigned}
          />
        </Suspense>
        </>
      )}

      <PDFPreviewDialog
        open={!!preview}
        onClose={() => setPreview(null)}
        doc={preview?.doc ?? null}
        fileName={preview?.name ?? "ficha-epi.pdf"}
        title="Ficha de Entrega de EPI — FOR-SEG 02"
      />
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, FileSignature, Download, Upload, Search, Settings2, AlertCircle, CheckCircle2, Clock, FileWarning, Eye, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { buildOssPdf } from "@/lib/oss-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { OssRowActions } from "@/components/oss/oss-row-actions";
import { OssAssinarButton } from "@/components/oss/oss-assinar-button";
import { EmployeeQuickView } from "@/components/employees/employee-quick-view";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/oss/")({
  component: OssIndexPage,
  head: () => ({ meta: [{ title: "Ordens de Serviço de Segurança · SIGMO" }] }),
});

type Emissao = {
  id: string;
  employee_id: string;
  template_id: string;
  template_revisao: number;
  cargo_snapshot: string;
  status: "PENDENTE_ASSINATURA" | "ASSINADO" | "VENCIDO" | "SUBSTITUIDO";
  motivo_emissao: string;
  emitido_em: string;
  assinado_em: string | null;
  expira_em: string | null;
  pdf_gerado_path: string | null;
  pdf_assinado_path: string | null;
  conteudo_snapshot: any;
  employees?: {
    nome: string; cpf: string | null; matricula: string | null; admissao: string | null;
    rg?: string | null;
    companies?: { name: string | null; cnpj: string | null } | null;
    roles?: { name: string | null; cbo?: string | null } | null;
  } | null;
  oss_templates?: { titulo: string; setor: string | null } | null;
};

const STATUS_META: Record<Emissao["status"], { label: string; cls: string; icon: any }> = {
  PENDENTE_ASSINATURA: { label: "Pendente assinatura", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  ASSINADO: { label: "Assinado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  VENCIDO: { label: "Vencido", cls: "bg-red-100 text-red-800 border-red-300", icon: AlertCircle },
  SUBSTITUIDO: { label: "Substituído", cls: "bg-slate-100 text-slate-600 border-slate-300", icon: FileWarning },
};
const STATUS_META_EXTRA: Record<string, { label: string; cls: string; icon: any }> = {
  ...STATUS_META,
  CANCELADO: { label: "Cancelado", cls: "bg-red-50 text-red-700 border-red-200 line-through", icon: Ban },
};

function OssIndexPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ATIVAS");
  const [emitirOpen, setEmitirOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ doc: jsPDF; name: string } | null>(null);

  const { data: emissoes = [], isLoading } = useQuery({
    queryKey: ["oss-emissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oss_emissoes")
        .select("*, employees(nome, cpf, matricula, admissao, rg, assinatura_url, companies(name, cnpj), roles(name, cbo)), oss_templates(titulo, setor, cbo)")
        .order("emitido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Emissao[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return emissoes.filter((e) => {
      if (filterStatus === "ATIVAS" && (e.status === "SUBSTITUIDO" || e.status === "VENCIDO" || (e.status as string) === "CANCELADO")) return false;
      if (filterStatus !== "ATIVAS" && filterStatus !== "TODAS" && e.status !== filterStatus) return false;
      if (!s) return true;
      return (
        (e.employees?.nome ?? "").toLowerCase().includes(s) ||
        e.cargo_snapshot.toLowerCase().includes(s) ||
        (e.employees?.cpf ?? "").includes(s)
      );
    });
  }, [emissoes, q, filterStatus]);

  const baixarPdf = async (em: Emissao) => {
    // Busca catálogo de EPIs do estoque pra preencher os C.A. automaticamente
    const { data: epiRows } = await supabase
      .from("estoque_epi")
      .select("nome_material, ca");
    const episCatalog = (epiRows ?? [])
      .filter((r: any) => r.nome_material && r.ca)
      .map((r: any) => ({ nome: r.nome_material as string, ca: r.ca as string }));
    // Sempre regerar a partir do snapshot pra evitar dependência do storage
    const doc = buildOssPdf({
      revisao: em.template_revisao,
      emitido_em: em.emitido_em,
      expira_em: em.expira_em,
      motivo_emissao: em.motivo_emissao,
      funcionario: {
        nome: em.employees?.nome ?? "—",
        cpf: em.employees?.cpf ?? null,
        matricula: em.employees?.matricula ?? null,
        admissao: em.employees?.admissao ?? null,
        rg: em.employees?.rg ?? null,
      },
      cargo: em.cargo_snapshot,
      cbo: em.conteudo_snapshot?.cbo ?? em.employees?.roles?.cbo ?? null,
      setor: em.oss_templates?.setor ?? null,
      empresa: em.employees?.companies?.name ?? null,
      empresa_cnpj: em.employees?.companies?.cnpj ?? null,
      conteudo: em.conteudo_snapshot,
      episCatalog,
      assinaturaColaboradorDataUrl: (em.employees as any)?.assinatura_url ?? null,
    });
    setPreviewDoc({ doc, name: `OSS-${em.cargo_snapshot}-${em.employees?.nome ?? "func"}.pdf` });
  };

  const uploadAssinado = useMutation({
    mutationFn: async ({ em, file }: { em: Emissao; file: File }) => {
      const path = `${em.id}/${Date.now()}-assinado.pdf`;
      const { error: upErr } = await supabase.storage.from("oss-pdfs").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("oss_emissoes")
        .update({
          pdf_assinado_path: path,
          status: "ASSINADO",
          assinado_em: new Date().toISOString(),
        })
        .eq("id", em.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PDF assinado anexado — OSS marcada como Assinada");
      qc.invalidateQueries({ queryKey: ["oss-emissoes"] });
    },
    onError: (e: any) => toast.error("Erro no upload: " + e.message),
  });

  const downloadAssinado = async (em: Emissao) => {
    if (!em.pdf_assinado_path) return;
    const { data, error } = await supabase.storage.from("oss-pdfs").createSignedUrl(em.pdf_assinado_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const [quickViewEmpId, setQuickViewEmpId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-6 pt-5 pb-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-[#991b1b] text-white shadow">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Ordens de Serviço de Segurança</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Conforme NR-01 item 1.4.1 alínea "c" — entregar OSS ao trabalhador na admissão, mudança de cargo ou revisão de risco.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/app/oss/templates"><Settings2 className="h-4 w-4 mr-1" />Modelos por Cargo</Link>
            </Button>
            {isEditor && (
              <Button onClick={() => setEmitirOpen(true)} className="bg-rose-600 hover:bg-rose-700">
                <Plus className="h-4 w-4 mr-1" />Emitir OSS
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar funcionário, cargo, CPF..." className="pl-8 h-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVAS">Ativas (pendentes + assinadas)</SelectItem>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="PENDENTE_ASSINATURA">Apenas pendentes</SelectItem>
              <SelectItem value="ASSINADO">Apenas assinadas</SelectItem>
              <SelectItem value="VENCIDO">Apenas vencidas</SelectItem>
              <SelectItem value="SUBSTITUIDO">Apenas substituídas</SelectItem>
              <SelectItem value="CANCELADO">Apenas canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          {isLoading && <div className="p-6 text-sm text-slate-500">Carregando...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center">
              <FileSignature className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Nenhuma OSS encontrada.</p>
              {emissoes.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Comece criando um <Link to="/app/oss/templates" className="text-rose-600 underline">modelo por cargo</Link>, depois emita a OSS para os funcionários.
                </p>
              )}
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emitido</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((em) => {
                  const meta = STATUS_META_EXTRA[em.status] ?? STATUS_META.PENDENTE_ASSINATURA;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={em.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setQuickViewEmpId(em.employee_id)}
                          className="text-left group"
                          title="Ver resumo do funcionário"
                        >
                          <div className="font-medium text-sm text-slate-900 group-hover:text-rose-600 group-hover:underline underline-offset-2 transition-colors">
                            {em.employees?.nome ?? "—"}
                          </div>
                          <div className="text-[10px] text-slate-500">{em.employees?.cpf ?? ""}</div>
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">{em.cargo_snapshot} <span className="text-[10px] text-slate-400">Rev.{em.template_revisao}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${meta.cls} text-[10px]`}>
                          <Icon className="h-3 w-3 mr-1" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDateBR(em.emitido_em.slice(0, 10))}</TableCell>
                      <TableCell className="text-xs">{em.expira_em ? formatDateBR(em.expira_em.slice(0, 10)) : "—"}</TableCell>
                      <TableCell className="text-[10px] text-slate-600">{em.motivo_emissao.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => baixarPdf(em)} title="Visualizar / Baixar PDF">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {em.pdf_assinado_path && (
                            <Button variant="ghost" size="sm" onClick={() => downloadAssinado(em)} title="Baixar assinado">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isEditor && em.status === "PENDENTE_ASSINATURA" && (
                            <>
                              <OssAssinarButton em={em} />
                              <UploadAssinadoButton
                                onPick={(f) => uploadAssinado.mutate({ em, file: f })}
                                disabled={uploadAssinado.isPending}
                              />
                            </>
                          )}
                          <OssRowActions em={em} invalidateKeys={[["oss-emissoes"], ["employee-oss", em.employee_id]]} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {emitirOpen && (
        <EmitirOssDialog
          open={true}
          onClose={() => setEmitirOpen(false)}
          onIssued={() => qc.invalidateQueries({ queryKey: ["oss-emissoes"] })}
        />
      )}
      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc?.doc ?? null}
        fileName={previewDoc?.name ?? "OSS.pdf"}
        title="Ordem de Serviço de Segurança"
      />
      <EmployeeQuickView
        employeeId={quickViewEmpId}
        open={!!quickViewEmpId}
        onClose={() => setQuickViewEmpId(null)}
      />
    </div>
  );
}

function UploadAssinadoButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  const inp = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inp}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inp.current) inp.current.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inp.current?.click()} disabled={disabled} title="Anexar PDF assinado" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
        <Upload className="h-3.5 w-3.5 mr-1" />Assinado
      </Button>
    </>
  );
}

// =====================================================
// Emitir OSS Dialog
// =====================================================
function EmitirOssDialog({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued: () => void }) {
  const [companyId, setCompanyId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("ADMISSAO");

  // Lista de empresas (ATIVAS)
  const { data: companies = [] } = useQuery({
    queryKey: ["oss-emit-companies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["oss-emit-employees", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, cpf, matricula, admissao, status, role_id, company_id, roles(name)")
        .eq("status", "ATIVO")
        .eq("company_id", companyId)
        .order("nome");
      return (data ?? []).map((e: any) => ({
        ...e,
        cargo: e.roles?.name ?? null,
      })) as Array<{
        id: string; nome: string; cpf: string | null; matricula: string | null;
        admissao: string | null; cargo: string | null;
      }>;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["oss-emit-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("oss_templates")
        .select("id, cargo, cbo, titulo, setor, revisao, validade_meses, descricao_atividades, riscos_texto, medidas_preventivas, epis_obrigatorios, proibicoes, penalidades, procedimentos_emergencia, risco_fisico, risco_quimico, risco_biologico, risco_ergonomico, risco_acidente, risco_psicossocial")
        .eq("ativo", true)
        .order("cargo");
      return (data ?? []) as any[];
    },
  });

  const selectedEmp = employees.find((e) => e.id === employeeId);

  // Auto-selecionar template baseado no cargo do funcionário
  const autoSuggestedTemplate = useMemo(() => {
    if (!selectedEmp?.cargo) return null;
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    const target = norm(selectedEmp.cargo);
    return (
      templates.find((t) => norm(t.cargo) === target) ??
      templates.find((t) => norm(t.cargo).includes(target) || target.includes(norm(t.cargo))) ??
      null
    );
  }, [selectedEmp, templates]);

  const effectiveTemplateId = templateId || autoSuggestedTemplate?.id || "";

  const emit = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Selecione o funcionário");
      if (!effectiveTemplateId) throw new Error("Selecione o modelo de OSS");
      const tpl = templates.find((t) => t.id === effectiveTemplateId);
      const emp = selectedEmp;
      if (!tpl || !emp) throw new Error("Dados inválidos");

      const { error } = await supabase.from("oss_emissoes").insert({
        employee_id: employeeId,
        template_id: tpl.id,
        template_revisao: tpl.revisao,
        cargo_snapshot: emp.cargo ?? tpl.cargo,
        motivo_emissao: motivo as any,
        conteudo_snapshot: {
          cbo: (tpl as any).cbo ?? null,
          descricao_atividades: tpl.descricao_atividades,
          riscos_texto: tpl.riscos_texto,
          medidas_preventivas: tpl.medidas_preventivas,
          epis_obrigatorios: tpl.epis_obrigatorios,
          proibicoes: tpl.proibicoes,
          penalidades: tpl.penalidades,
          procedimentos_emergencia: tpl.procedimentos_emergencia,
          riscos_categorias: {
            fisico: (tpl as any).risco_fisico ?? null,
            quimico: (tpl as any).risco_quimico ?? null,
            biologico: (tpl as any).risco_biologico ?? null,
            ergonomico: (tpl as any).risco_ergonomico ?? null,
            acidente: (tpl as any).risco_acidente ?? null,
            psicossocial: (tpl as any).risco_psicossocial ?? null,
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OSS emitida — baixe o PDF, imprima e colete a assinatura física");
      onIssued();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Emitir nova OSS</DialogTitle>
          <DialogDescription className="text-xs">
            Após emitir, baixe o PDF, imprima, colete as assinaturas físicas e anexe o PDF escaneado na lista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 min-w-0">
          <div>
            <Label className="text-[10px] font-black uppercase">Empresa *</Label>
            <Select
              value={companyId}
              onValueChange={(v) => { setCompanyId(v); setEmployeeId(""); setTemplateId(""); }}
            >
              <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione a empresa..." className="truncate" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Funcionário *</Label>
            <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setTemplateId(""); }} disabled={!companyId}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={companyId ? "Selecione..." : "Escolha a empresa primeiro"} className="truncate" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {employees.length === 0 && companyId && (
                  <div className="px-2 py-3 text-xs text-slate-500">Nenhum funcionário ativo nesta empresa.</div>
                )}
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cargo ?? "(sem cargo)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Modelo de OSS *</Label>
            <Select value={effectiveTemplateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione o modelo..." className="truncate" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.cargo} — {t.titulo} (Rev. {t.revisao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {autoSuggestedTemplate && !templateId && (
              <div className="text-[10px] text-emerald-700 mt-1">✓ Modelo sugerido pelo cargo do funcionário</div>
            )}
            {selectedEmp?.cargo && !autoSuggestedTemplate && (
              <div className="text-[10px] text-amber-700 mt-1">
                ⚠ Nenhum modelo para o cargo "{selectedEmp.cargo}". <Link to="/app/oss/templates" className="underline">Criar modelo</Link>
              </div>
            )}
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Motivo da emissão</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMISSAO">Admissão</SelectItem>
                <SelectItem value="MUDANCA_CARGO">Mudança de cargo</SelectItem>
                <SelectItem value="REVISAO_RISCO">Revisão de risco / EPI</SelectItem>
                <SelectItem value="RECICLAGEM_ANUAL">Reciclagem anual</SelectItem>
                <SelectItem value="EMISSAO_MANUAL">Emissão manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-row justify-end gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => emit.mutate()} disabled={emit.isPending || !employeeId || !effectiveTemplateId} className="bg-rose-600 hover:bg-rose-700">
            <FileSignature className="h-4 w-4 mr-1" />Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

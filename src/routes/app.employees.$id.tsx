import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Syringe, Upload, FileText, Camera, X, AlertTriangle, Undo2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { formatDateBR, addMonthsToDate } from "@/lib/utils-date";
import { NRS_LIST, TIPOS_EXAME, NATUREZAS_EXAME, UFS, VACINAS_LIST } from "@/lib/constants";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";
import { openFileViewer } from "@/components/file-viewer";
import { openEpiFichaPdf } from "@/lib/epi-ficha-pdf";
import { HardHat, Printer, FileSignature } from "lucide-react";

export const Route = createFileRoute("/app/employees/$id")({
  component: EmployeeDetail,
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ tab: z.string().optional() }).parse(search),
});

function EmployeeDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  return (
    <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-brand">
          <Link to="/app/employees"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
      </div>
      <EmployeeDetailContent id={id} showHeader initialTab={tab} />
      <FileViewerHost />
    </div>
  );
}

export function EmployeeDetailContent({ id, showHeader = true, initialTab }: { id: string; showHeader?: boolean; initialTab?: string }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const VALID_TABS = ["profile","nrs","docs","epi","health"];
  const [tab, setTab] = useState<string>(VALID_TABS.includes(initialTab ?? "") ? (initialTab as string) : "profile");
  const [healthSub, setHealthSub] = useState<string>(initialTab === "vaccines" ? "vaccines" : "exams");

  const { data: emp } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("*").order("name")).data ?? [],
  });
  const { data: exams } = useQuery({
    queryKey: ["exams", id],
    queryFn: async () => (await supabase.from("employee_exams").select("*").eq("employee_id", id).order("data_realizacao", { ascending: false })).data ?? [],
  });
  const { data: epis } = useQuery({
    queryKey: ["epis", id],
    queryFn: async () => (await supabase.from("epi_deliveries").select("*").eq("employee_id", id).order("data_entrega", { ascending: false })).data ?? [],
  });
  const { data: vaccines } = useQuery({
    queryKey: ["vaccines", id],
    queryFn: async () => (await supabase.from("employee_vaccinations").select("*").eq("employee_id", id).order("data_aplicacao", { ascending: false })).data ?? [],
  });

  const role = (roles ?? []).find((r: any) => r.id === emp?.role_id) ?? null;
  const status = emp ? calculateSafetyStatus(emp as any, role as any, (exams ?? []) as any, (vaccines ?? []) as any) : null;
  const canEditHeader = isEditor || isAdmin;
  const [uploadingHeaderPhoto, setUploadingHeaderPhoto] = useState(false);

  const { data: docsList } = useQuery({
    queryKey: ["docs", id],
    queryFn: async () => (await supabase.from("employee_docs").select("tipo").eq("employee_id", id)).data ?? [],
  });
  const REQUIRED_DOCS = ["RG", "CPF", "Comprovante Residência", "Comprovante MEI", "Cartão de Vacina"];
  const docsTipos = new Set((docsList ?? []).map((d: any) => d.tipo));
  const missingDocs = REQUIRED_DOCS.filter((t) => !docsTipos.has(t));
  const docsOk = missingDocs.length === 0;

  function initialsOf(name?: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function removeHeaderPhoto() {
    if (!emp?.foto_url) return;
    if (!confirm("Remover a foto do colaborador?")) return;
    try {
      try {
        const url = new URL(emp.foto_url);
        const marker = "/avatars/";
        const idx = url.pathname.indexOf(marker);
        if (idx >= 0) {
          const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
          await supabase.storage.from("avatars").remove([path]);
        }
      } catch { /* ignore parse errors */ }
      const { error } = await supabase.from("employees").update({ foto_url: null }).eq("id", emp.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Foto removida");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleHeaderPhotoUpload(file: File) {
    if (!file || !emp) return;
    setUploadingHeaderPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${emp.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await supabase.from("employees").update({ foto_url: pub.publicUrl }).eq("id", emp.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Foto atualizada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingHeaderPhoto(false);
    }
  }

  if (!emp) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      {showHeader && (
      <Card className="p-6 flex flex-wrap items-center gap-6 rounded-2xl border-slate-200 shadow-sm">
        <div className="relative h-20 w-20 shrink-0">
          <label className={`relative h-20 w-20 rounded-full overflow-hidden border-2 border-slate-200 flex items-center justify-center bg-gradient-to-br from-brand/80 to-brand text-white ${canEditHeader ? "cursor-pointer hover:border-brand transition-colors" : ""}`}>
            {emp.foto_url ? (
              <img src={emp.foto_url} alt={emp.nome} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-black tracking-wider select-none">{initialsOf(emp.nome)}</span>
            )}
            {canEditHeader && (
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingHeaderPhoto}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleHeaderPhotoUpload(file); }}
              />
            )}
          </label>
          {canEditHeader && emp.foto_url && (
            <button
              type="button"
              onClick={removeHeaderPhoto}
              title="Remover foto"
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-600 hover:text-destructive hover:border-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 min-w-[240px]">
          <h1 className="heading-display text-3xl text-brand">{emp.nome}</h1>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            {emp.cpf ?? "—"} · {emp.matricula ?? "—"}
          </div>
        </div>
        {status && (
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${status.colorClass}`} />
            <Badge className={`${status.colorClass} text-white border-0 text-[10px] font-black uppercase tracking-widest`}>{status.label}</Badge>
          </div>
        )}
      </Card>
      )}

      {!docsOk && (
        <Card className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-amber-500 text-white flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-black uppercase tracking-widest text-amber-700">Documentação incompleta</div>
            <div className="text-xs text-amber-800 mt-0.5">
              Pendências: <strong>{missingDocs.join(", ")}</strong>. A geração de relatórios e fichas está bloqueada até que todos os 5 documentos obrigatórios sejam enviados.
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => setTab("docs")}>
            Ir para Docs
          </Button>
        </Card>
      )}

      {status && status.msgs.length > 0 && (
        <Card className="p-4 flex flex-wrap gap-2">
          {status.msgs.map((m, i) => (
            <Badge key={i} variant="outline">{m}</Badge>
          ))}
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="nrs">NRs</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
          <TabsTrigger value="epi">EPI</TabsTrigger>
          <TabsTrigger value="health">Saúde</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab emp={emp} companies={companies ?? []} roles={roles ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
        </TabsContent>
        <TabsContent value="nrs" className="mt-4">
          <NrsTab emp={emp} role={role} canEdit={isEditor} qc={qc} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <DocsTab empId={id} />
        </TabsContent>
        <TabsContent value="epi" className="mt-4">
          <EpiTab empId={id} epis={epis ?? []} emp={emp} company={(companies ?? []).find((c: any) => c.id === emp.company_id) ?? null} role={role} canEdit={isEditor} canDelete={isAdmin} qc={qc} docsOk={docsOk} missingDocs={missingDocs} />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <Tabs value={healthSub} onValueChange={setHealthSub}>
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="exams">Exames / ASO</TabsTrigger>
              <TabsTrigger value="vaccines">Vacinas</TabsTrigger>
            </TabsList>
            <TabsContent value="exams" className="mt-4">
              <HealthTab empId={id} exams={exams ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
            </TabsContent>
            <TabsContent value="vaccines" className="mt-4">
              <VaccinesTab empId={id} vaccines={vaccines ?? []} role={role} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      <FileViewerHost />
    </div>
  );
}

/* ============ PROFILE ============ */
function ProfileTab({ emp, companies, roles, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>(emp);
  const save = useMutation({
    mutationFn: async () => {
      const { id: _id, created_at, updated_at, ...rest } = f;
      const { error } = await supabase.from("employees").update(rest).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee", emp.id] }); qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").delete().eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); window.location.href = "/app/employees"; },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome *"><Input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Status">
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">ATIVO</SelectItem>
              <SelectItem value="INATIVO">INATIVO</SelectItem>
              <SelectItem value="AFASTADO">AFASTADO</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Empresa">
          <Select value={f.company_id ?? ""} onValueChange={(v) => setF({ ...f, company_id: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Cargo">
          <Select value={f.role_id ?? ""} onValueChange={(v) => setF({ ...f, role_id: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="CPF"><Input value={f.cpf ?? ""} onChange={(e) => setF({ ...f, cpf: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Matrícula"><Input value={f.matricula ?? ""} onChange={(e) => setF({ ...f, matricula: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="RG"><Input value={f.rg ?? ""} onChange={(e) => setF({ ...f, rg: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Órgão Emissor"><Input value={f.rg_orgao ?? ""} onChange={(e) => setF({ ...f, rg_orgao: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Tipo cadastro">
          <Select value={f.tipo_cadastro} onValueChange={(v) => setF({ ...f, tipo_cadastro: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NAO_MEI">CLT/NÃO MEI</SelectItem>
              <SelectItem value="MEI">MEI</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CNPJ (MEI)"><Input value={f.cnpj ?? ""} onChange={(e) => setF({ ...f, cnpj: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Admissão"><Input type="date" value={f.admissao ?? ""} onChange={(e) => setF({ ...f, admissao: e.target.value || null })} disabled={!canEdit} /></Field>
        <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="WhatsApp"><Input value={f.whatsapp ?? ""} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Contato Emergência"><Input value={f.nome_contato ?? ""} onChange={(e) => setF({ ...f, nome_contato: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="WhatsApp Emergência"><Input value={f.whatsapp_emergencia ?? ""} onChange={(e) => setF({ ...f, whatsapp_emergencia: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Endereço" className="md:col-span-2"><Input value={f.endereco ?? ""} onChange={(e) => setF({ ...f, endereco: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Bairro"><Input value={f.bairro ?? ""} onChange={(e) => setF({ ...f, bairro: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Cidade"><Input value={f.cidade ?? ""} onChange={(e) => setF({ ...f, cidade: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="UF">
          <Select value={f.uf ?? ""} onValueChange={(v) => setF({ ...f, uf: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="CEP"><Input value={f.cep ?? ""} onChange={(e) => setF({ ...f, cep: e.target.value })} disabled={!canEdit} /></Field>
      </div>
      <div className="flex justify-between pt-4 border-t">
        {canDelete ? (
          <Button variant="destructive" onClick={() => { if (confirm("Excluir colaborador?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4 mr-2" />Excluir
          </Button>
        ) : <div />}
        {canEdit && <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar alterações</Button>}
      </div>
    </Card>
  );
}

function Field({ label, children, className }: any) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ============ NRs ============ */
function NrsTab({ emp, role, canEdit, qc }: any) {
  const [nrs, setNrs] = useState<Record<string, string>>(emp.nrs ?? {});
  const [intDate, setIntDate] = useState(emp.data_integracao ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").update({ nrs, data_integracao: intDate || null }).eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee", emp.id] }); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });

  const reqNrs: string[] = role?.req_nrs ?? [];
  const allNrs = Array.from(new Set([...reqNrs, ...NRS_LIST])).sort();

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-1.5 max-w-xs">
        <Label className="text-xs">Data da Integração</Label>
        <Input type="date" value={intDate ?? ""} onChange={(e) => setIntDate(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {allNrs.map((nr) => {
          const isReq = reqNrs.includes(nr);
          return (
            <div key={nr} className={`rounded-md border p-3 ${isReq ? "border-brand" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{nr}</span>
                {isReq && <Badge className="bg-brand text-brand-foreground text-[10px]">Requerida</Badge>}
              </div>
              <Input
                type="date"
                value={nrs[nr] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const copy = { ...nrs };
                  if (v) copy[nr] = v; else delete copy[nr];
                  setNrs(copy);
                }}
                disabled={!canEdit}
              />
            </div>
          );
        })}
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></div>}
    </Card>
  );
}

/* ============ DOCS ============ */
function DocsTab({ empId }: any) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const { data: docs } = useQuery({
    queryKey: ["docs", empId],
    queryFn: async () => (await supabase.from("employee_docs").select("*").eq("employee_id", empId)).data ?? [],
  });
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const [extraTipo, setExtraTipo] = useState("CNH");
  const [extraFile, setExtraFile] = useState<File | null>(null);

  async function uploadFor(tipo: string, file: File) {
    setUploadingTipo(tipo);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${empId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("employee_docs").insert({ employee_id: empId, tipo, file_path: path });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["docs", empId] });
      toast.success(`${tipo} enviado`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingTipo(null);
    }
  }

  const uploadExtra = useMutation({
    mutationFn: async () => {
      if (!extraFile) throw new Error("Selecione um arquivo");
      await uploadFor(extraTipo, extraFile);
    },
    onSuccess: () => setExtraFile(null),
  });

  const del = useMutation({
    mutationFn: async (d: any) => {
      await supabase.storage.from("employee-docs").remove([d.file_path]);
      const { error } = await supabase.from("employee_docs").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs", empId] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function openDoc(path: string) {
    await openStorageFile("employee-docs", path);
  }

  const REQUIRED_DOCS = ["RG", "CPF", "Comprovante Residência", "Comprovante MEI", "Cartão de Vacina"];
  const TIPOS_EXTRA = ["CNH", "CTPS", "Título de Eleitor", "Certificado Reservista", "Foto 3x4", "Contrato", "Outro"];

  const docsByTipo = (docs ?? []).reduce((acc: Record<string, any[]>, d: any) => {
    (acc[d.tipo] ||= []).push(d);
    return acc;
  }, {});

  const missing = REQUIRED_DOCS.filter((t) => !(docsByTipo[t]?.length));
  const allOk = missing.length === 0;
  const extraDocs = (docs ?? []).filter((d: any) => !REQUIRED_DOCS.includes(d.tipo));

  return (
    <div className="space-y-4">
      <Card className={`p-4 flex items-center justify-between rounded-2xl border-2 ${allOk ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${allOk ? "bg-emerald-500" : "bg-amber-500"} text-white`}>
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className={`text-sm font-black uppercase tracking-widest ${allOk ? "text-emerald-700" : "text-amber-700"}`}>
              {allOk ? "Documentos em dia" : "Documentos pendentes"}
            </div>
            <div className="text-xs text-slate-600">
              {allOk
                ? `Todos os ${REQUIRED_DOCS.length} documentos obrigatórios foram enviados.`
                : `Faltando: ${missing.join(", ")}`}
            </div>
          </div>
        </div>
        <Badge className={`${allOk ? "bg-emerald-600" : "bg-amber-600"} text-white text-[10px] font-black uppercase tracking-widest`}>
          {REQUIRED_DOCS.length - missing.length}/{REQUIRED_DOCS.length}
        </Badge>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">Documentos obrigatórios</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REQUIRED_DOCS.map((tipo) => {
            const items = docsByTipo[tipo] ?? [];
            const has = items.length > 0;
            return (
              <div key={tipo} className={`rounded-xl border p-3 flex items-center gap-3 ${has ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40"}`}>
                <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${has ? "bg-emerald-500" : "bg-slate-300"} text-white`}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{tipo}</div>
                  <div className="text-[10px] text-slate-500">
                    {has ? `Enviado em ${formatDateBR(items[0].uploaded_at)}` : "Não enviado"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {has && (
                    <Button size="sm" variant="ghost" onClick={() => openDoc(items[0].file_path)}>
                      <FileText className="h-4 w-4 mr-1" />Ver
                    </Button>
                  )}
                  {isEditor && (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={uploadingTipo === tipo}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFor(tipo, file); e.target.value = ""; }}
                      />
                      <span className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold rounded-md bg-brand text-white hover:bg-brand/90 cursor-pointer">
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {uploadingTipo === tipo ? "Enviando..." : has ? "Substituir" : "Enviar"}
                      </span>
                    </label>
                  )}
                  {has && isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(items[0])}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">Outros documentos</div>
        {isEditor && (
          <form onSubmit={(e) => { e.preventDefault(); uploadExtra.mutate(); }} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end border-b pb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={extraTipo} onValueChange={setExtraTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_EXTRA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Arquivo (PDF/Imagem)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setExtraFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="md:col-span-3" disabled={uploadExtra.isPending || !extraFile}>
              <Upload className="h-4 w-4 mr-2" /> Enviar documento
            </Button>
          </form>
        )}
        {extraDocs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">Nenhum documento adicional</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Arquivo</TableHead><TableHead>Enviado em</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {extraDocs.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.tipo}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openDoc(d.file_path)}>
                      <FileText className="h-4 w-4 mr-1" />Ver
                    </Button>
                  </TableCell>
                  <TableCell>{formatDateBR(d.uploaded_at)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && <Button size="icon" variant="ghost" onClick={() => del.mutate(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ============ VACCINES ============ */
function VaccinesTab({ empId, vaccines, role, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>({
    tipo_vacina: VACINAS_LIST[0],
    dose: "1ª dose",
    data_aplicacao: new Date().toISOString().slice(0, 10),
    data_proxima_dose: "",
    lote: "",
    fabricante: "",
    observacoes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const reqVacinas: string[] = role?.req_vacinas ?? [];
  const riscoBio: boolean = !!role?.risco_biologico;

  const create = useMutation({
    mutationFn: async () => {
      let anexo_path: string | null = null;
      if (file) {
        const path = `${empId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("vaccination-cards").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        anexo_path = path;
      }
      const { error } = await supabase.from("employee_vaccinations").insert({
        employee_id: empId,
        tipo_vacina: f.tipo_vacina,
        dose: f.dose || null,
        data_aplicacao: f.data_aplicacao,
        data_proxima_dose: f.data_proxima_dose || null,
        lote: f.lote || null,
        fabricante: f.fabricante || null,
        observacoes: f.observacoes || null,
        anexo_path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccines", empId] });
      qc.invalidateQueries({ queryKey: ["employee", empId] });
      setFile(null);
      toast.success("Vacina registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_vaccinations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vaccines", empId] }); toast.success("Removida"); },
  });

  async function openCard(path: string) {
    await openStorageFile("vaccination-cards", path);
  }

  // Status por vacina obrigatória
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const latestByType: Record<string, any> = {};
  vaccines.forEach((v: any) => {
    if (!latestByType[v.tipo_vacina] || new Date(v.data_aplicacao) > new Date(latestByType[v.tipo_vacina].data_aplicacao)) {
      latestByType[v.tipo_vacina] = v;
    }
  });

  return (
    <Card className="p-6 space-y-6">
      {riscoBio && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex gap-3 items-start">
          <Syringe className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900">
            <div className="font-black uppercase tracking-widest mb-1">Função com Risco Biológico (PCMSO Rev.05)</div>
            Esta função exige imunização ativa. Vacinas vencidas ou sem carteira anexada bloqueiam automaticamente o status do colaborador e a emissão de PTE para Limpeza de Tanque.
          </div>
        </div>
      )}

      {reqVacinas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reqVacinas.map((vac) => {
            const v = latestByType[vac];
            let cls = "border-red-300 bg-red-50";
            let label = "Falta";
            if (v) {
              if (!v.anexo_path) { cls = "border-red-300 bg-red-50"; label = "Sem carteira"; }
              else if (v.data_proxima_dose) {
                const exp = new Date(v.data_proxima_dose + "T00:00:00");
                if (exp < today) { cls = "border-red-300 bg-red-50"; label = "Vencida"; }
                else { cls = "border-emerald-300 bg-emerald-50"; label = "Em dia"; }
              } else { cls = "border-emerald-300 bg-emerald-50"; label = "Em dia"; }
            }
            return (
              <div key={vac} className={`rounded-xl border p-3 ${cls}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">{vac}</span>
                  <Badge className="text-[9px]">{label}</Badge>
                </div>
                {v && (
                  <div className="text-[10px] text-slate-600 font-bold uppercase">
                    Aplicada: {formatDateBR(v.data_aplicacao)}
                    {v.data_proxima_dose && <> · Próx.: {formatDateBR(v.data_proxima_dose)}</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-t pt-4">
          <Field label="Vacina">
            <Select value={f.tipo_vacina} onValueChange={(v) => setF({ ...f, tipo_vacina: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VACINAS_LIST.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Dose">
            <Select value={f.dose} onValueChange={(v) => setF({ ...f, dose: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1ª dose">1ª dose</SelectItem>
                <SelectItem value="2ª dose">2ª dose</SelectItem>
                <SelectItem value="3ª dose">3ª dose</SelectItem>
                <SelectItem value="Reforço">Reforço</SelectItem>
                <SelectItem value="Dose única">Dose única</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aplicação"><Input type="date" required value={f.data_aplicacao} onChange={(e) => setF({ ...f, data_aplicacao: e.target.value })} /></Field>
          <Field label="Próxima dose / Validade"><Input type="date" value={f.data_proxima_dose} onChange={(e) => setF({ ...f, data_proxima_dose: e.target.value })} /></Field>
          <Field label="Lote"><Input value={f.lote} onChange={(e) => setF({ ...f, lote: e.target.value })} /></Field>
          <Field label="Fabricante"><Input value={f.fabricante} onChange={(e) => setF({ ...f, fabricante: e.target.value })} /></Field>
          <Field label="Carteira (PDF/Imagem)" className="col-span-2">
            <div className="flex items-center gap-2">
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && <Badge variant="outline" className="text-[10px]"><Upload className="h-3 w-3 mr-1" />{file.name}</Badge>}
            </div>
          </Field>
          <Field label="Observações" className="col-span-2 md:col-span-4"><Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2 md:col-span-4" disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Registrar Vacina
          </Button>
        </form>
      )}

      <Table>
        <TableHeader><TableRow><TableHead>Vacina</TableHead><TableHead>Dose</TableHead><TableHead>Aplicação</TableHead><TableHead>Próxima/Validade</TableHead><TableHead>Lote</TableHead><TableHead>Carteira</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {vaccines.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma vacina registrada</TableCell></TableRow>}
          {vaccines.map((v: any) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.tipo_vacina}</TableCell>
              <TableCell>{v.dose ?? "—"}</TableCell>
              <TableCell>{formatDateBR(v.data_aplicacao)}</TableCell>
              <TableCell>{v.data_proxima_dose ? formatDateBR(v.data_proxima_dose) : "—"}</TableCell>
              <TableCell>{v.lote ?? "—"}</TableCell>
              <TableCell>
                {v.anexo_path ? (
                  <Button size="sm" variant="ghost" onClick={() => openCard(v.anexo_path)}>
                    <FileText className="h-4 w-4 mr-1" /> Ver
                  </Button>
                ) : <span className="text-xs text-red-500 font-bold">Sem anexo</span>}
              </TableCell>
              <TableCell className="text-right">
                {canDelete && <Button size="icon" variant="ghost" onClick={() => del.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ============ EPI ============ */
function EpiTab({ empId, epis, emp, company, role, canEdit, canDelete, qc, docsOk, missingDocs }: any) {
  const EPI_ITEMS = [
    "TREINAMENTOS","AVENTAL DE RASPA","BALACLAVA","BOTA","CALÇA","CAMISA",
    "CAPACETE","LENTES DE SOLDA","LUVA","MANGOTE DE RASPA","MÁSCARA DE SOLDA",
    "ÓCULOS","PROT. AURICULAR","VISEIRAS",
  ];
  const SIZES_BY_ITEM: Record<string, string[]> = {
    "CAMISA": ["PP","P","M","G","GG","XGG","EXG"],
    "CALÇA": ["PP","P","M","G"],
    "BOTA": ["36","37","38","39","40","41","42","43","44"],
  };
  const [f, setF] = useState<any>({ item: "", ca: "", tamanho: "", qtd: 1, data_entrega: new Date().toISOString().slice(0, 10) });
  const sizeOptions = SIZES_BY_ITEM[f.item] ?? null;
  const MOTIVOS_DEV = ["Danificado", "Desgaste Natural", "Extravio", "Mal Uso", "Furto", "Uso Temporário"];
  const [substitution, setSubstitution] = useState<{ prev: any; motivo: string; data: string; obs: string } | null>(null);

  function resetForm() {
    setF({ item: "", ca: "", tamanho: "", qtd: 1, data_entrega: new Date().toISOString().slice(0, 10) });
  }

  async function insertNewDelivery() {
    const { error } = await supabase.from("epi_deliveries").insert({
      employee_id: empId, item: f.item, ca: f.ca || null, tamanho: f.tamanho || null,
      qtd: Number(f.qtd) || 1, data_entrega: f.data_entrega,
    });
    if (error) throw error;
  }

  const create = useMutation({
    mutationFn: insertNewDelivery,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); resetForm(); toast.success("Entregue"); },
    onError: (e: any) => toast.error(e.message),
  });

  const substituteMut = useMutation({
    mutationFn: async () => {
      if (!substitution) return;
      const obs = `Motivo: ${substitution.motivo}${substitution.obs ? ` — ${substitution.obs}` : ""}`;
      // 1) close previous delivery
      const { error: upErr } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: substitution.data, observacoes: obs })
        .eq("id", substitution.prev.id);
      if (upErr) throw upErr;
      // 2) insert new delivery
      await insertNewDelivery();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      resetForm();
      setSubstitution(null);
      toast.success("Substituição registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function submitDelivery() {
    if (!f.item) return;
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    // Find an active (non-returned) prior delivery of the same item
    const prev = (epis ?? []).find((e: any) => !e.data_devolucao && norm(e.item) === norm(f.item));
    if (prev) {
      setSubstitution({
        prev,
        motivo: "Desgaste Natural",
        data: f.data_entrega,
        obs: "",
      });
      return;
    }
    create.mutate();
  }
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("epi_deliveries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); toast.success("Removido"); },
  });

  const [returning, setReturning] = useState<any | null>(null);
  const [retForm, setRetForm] = useState<{ motivo: string; data: string; obs: string }>({
    motivo: "Desgaste Natural",
    data: new Date().toISOString().slice(0, 10),
    obs: "",
  });

  function openReturn(item: any) {
    setRetForm({ motivo: "Desgaste Natural", data: new Date().toISOString().slice(0, 10), obs: "" });
    setReturning(item);
  }

  const returnMut = useMutation({
    mutationFn: async () => {
      if (!returning) return;
      const obs = `Motivo: ${retForm.motivo}${retForm.obs ? ` — ${retForm.obs}` : ""}`;
      const { error } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: retForm.data, observacoes: obs })
        .eq("id", returning.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      toast.success("Devolução registrada");
      setReturning(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const undoReturn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: null, observacoes: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); toast.success("Devolução desfeita"); },
    onError: (e: any) => toast.error(e.message),
  });

  function gerarFicha() {
    if (!docsOk) {
      toast.error(`Documentação incompleta. Pendentes: ${(missingDocs ?? []).join(", ")}`);
      return;
    }
    const { url, fname } = openEpiFichaPdf({ emp, company, role, epis });
    openFileViewer({ url, name: fname, mime: "application/pdf" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-black uppercase tracking-wider text-brand">Controle de EPIs</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Gestão de entregas e impressão da ficha de EPI
          </p>
        </div>
        <Button
          onClick={gerarFicha}
          disabled={!docsOk}
          title={!docsOk ? `Bloqueado: documentação incompleta (${(missingDocs ?? []).join(", ")})` : "Gerar Ficha de EPI"}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          size="lg"
        >
          <Printer className="h-4 w-4 mr-2" /> Ficha em PDF
        </Button>
      </Card>

      {/* Form */}
      {canEdit && (
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-brand" />
            <h3 className="text-xs font-black uppercase tracking-widest text-brand">Registrar entrega de EPI</h3>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição do EPI</Label>
              <Select value={f.item} onValueChange={(v) => setF({ ...f, item: v, tamanho: "" })}>
                <SelectTrigger><SelectValue placeholder="Ex: CAPACETE, LUVA…" /></SelectTrigger>
                <SelectContent>{EPI_ITEMS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tamanho / Modelo</Label>
              {sizeOptions ? (
                <Select value={f.tamanho} onValueChange={(v) => setF({ ...f, tamanho: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={f.tamanho} onChange={(e) => setF({ ...f, tamanho: e.target.value })} placeholder="Ex: TAM 42, INCOLOR…" />
              )}
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">C.A.</Label>
              <Input value={f.ca} onChange={(e) => setF({ ...f, ca: e.target.value })} placeholder="Apenas Número" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entrega</Label>
              <Input type="date" value={f.data_entrega} onChange={(e) => setF({ ...f, data_entrega: e.target.value })} />
            </div>
            <div className="md:col-span-1 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">QTD</Label>
              <Input type="number" min="1" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
            </div>
            <div className="md:col-span-12 flex justify-end">
              <Button type="submit" disabled={create.isPending || !f.item} className="bg-brand text-white">
                <Plus className="h-4 w-4 mr-2" /> Registrar entrega
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* History as cards */}
      <Card className="p-5 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-slate-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Histórico de EPIs recebidos</h3>
        </div>
        {epis.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhum EPI entregue</div>
        )}
        <div className="space-y-2">
          {epis.map((e: any) => (
            <div
              key={e.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition ${e.data_devolucao ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"}`}
            >
              <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <HardHat className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-slate-800 uppercase">{e.item}</span>
                  {e.tamanho && <span className="text-xs text-slate-500">({e.tamanho})</span>}
                  <Badge variant="secondary" className="text-[10px]">QTD: {e.qtd}</Badge>
                  {e.data_devolucao ? (
                    <Badge className="bg-amber-500 text-white text-[10px]">DEVOLVIDO</Badge>
                  ) : (
                    <Badge className="bg-emerald-500 text-white text-[10px]">EM USO</Badge>
                  )}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                  C.A.: {e.ca ?? "N/A"} • Entregue em: <span className="text-slate-700">{formatDateBR(e.data_entrega)}</span>
                  {e.data_devolucao && (
                    <> • Devolvido em: <span className="text-amber-700">{formatDateBR(e.data_devolucao)}</span></>
                  )}
                </div>
                {e.data_devolucao && e.observacoes && (
                  <div className="text-[11px] text-amber-800 mt-0.5 normal-case">{e.observacoes}</div>
                )}
              </div>
              {canEdit && !e.data_devolucao && (
                <Button size="sm" variant="outline" onClick={() => openReturn(e)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Undo2 className="h-4 w-4 mr-1" /> Devolver
                </Button>
              )}
              {canEdit && e.data_devolucao && (
                <Button size="sm" variant="ghost" onClick={() => undoReturn.mutate(e.id)} title="Desfazer devolução">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </Button>
              )}
              {canDelete && (
                <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Devolução Dialog */}
      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Devolução de EPI
            </DialogTitle>
          </DialogHeader>
          {returning && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-black uppercase text-slate-700">{returning.item}</div>
                <div className="text-slate-500 mt-0.5">
                  {returning.tamanho ? `Tam: ${returning.tamanho} • ` : ""}QTD: {returning.qtd} • Entregue em {formatDateBR(returning.data_entrega)}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da devolução</Label>
                <Select value={retForm.motivo} onValueChange={(v) => setRetForm({ ...retForm, motivo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DEV.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data da devolução</Label>
                <Input type="date" value={retForm.data} onChange={(e) => setRetForm({ ...retForm, data: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações (opcional)</Label>
                <Textarea rows={3} value={retForm.obs} onChange={(e) => setRetForm({ ...retForm, obs: e.target.value })} placeholder="Detalhes adicionais sobre a devolução…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturning(null)}>Cancelar</Button>
            <Button onClick={() => returnMut.mutate()} disabled={returnMut.isPending || !retForm.data || !retForm.motivo} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Undo2 className="h-4 w-4 mr-2" /> Registrar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ HEALTH ============ */
function HealthTab({ empId, exams, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>({
    tipo_exame: "ASO Clínico", natureza: "Periódico", periodicidade_meses: 12,
    data_realizacao: new Date().toISOString().slice(0, 10), data_vencimento: addMonthsToDate(new Date().toISOString().slice(0, 10), 12),
    aptidao: "SIM", observacoes: "",
  });
  const [examFile, setExamFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const venc = f.data_vencimento || addMonthsToDate(f.data_realizacao, Number(f.periodicidade_meses) || 12);
      let anexo_path: string | null = null;
      if (examFile) {
        const path = `${empId}/exames/${Date.now()}_${examFile.name}`;
        const { error: upErr } = await supabase.storage.from("employee-docs").upload(path, examFile, { upsert: false });
        if (upErr) throw upErr;
        anexo_path = path;
      }
      const { error } = await supabase.from("employee_exams").insert({
        employee_id: empId, tipo_exame: f.tipo_exame, natureza: f.natureza,
        periodicidade_meses: Number(f.periodicidade_meses) || 12,
        data_realizacao: f.data_realizacao, data_vencimento: venc,
        aptidao: f.aptidao, observacoes: f.observacoes || null, anexo_path,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); qc.invalidateQueries({ queryKey: ["employee", empId] }); setExamFile(null); toast.success("Exame registrado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (ex: any) => {
      if (ex.anexo_path) await supabase.storage.from("employee-docs").remove([ex.anexo_path]);
      const { error } = await supabase.from("employee_exams").delete().eq("id", ex.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); toast.success("Removido"); },
  });

  async function openExam(path: string) {
    await openStorageFile("employee-docs", path);
  }

  return (
    <Card className="p-6 space-y-6">
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end border-b pb-4">
          <Field label="Tipo">
            <Select value={f.tipo_exame} onValueChange={(v) => setF({ ...f, tipo_exame: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_EXAME.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Natureza">
            <Select value={f.natureza} onValueChange={(v) => setF({ ...f, natureza: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NATUREZAS_EXAME.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Periodicidade (meses)"><Input type="number" min="1" value={f.periodicidade_meses} onChange={(e) => setF({ ...f, periodicidade_meses: e.target.value })} /></Field>
          <Field label="Aptidão">
            <Select value={f.aptidao} onValueChange={(v) => setF({ ...f, aptidao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIM">APTO</SelectItem>
                <SelectItem value="NÃO">INAPTO</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Realização"><Input type="date" value={f.data_realizacao} onChange={(e) => setF({ ...f, data_realizacao: e.target.value, data_vencimento: addMonthsToDate(e.target.value, Number(f.periodicidade_meses) || 12) })} /></Field>
          <Field label="Vencimento"><Input type="date" value={f.data_vencimento} onChange={(e) => setF({ ...f, data_vencimento: e.target.value })} /></Field>
          <Field label="PDF do exame/ASO" className="col-span-2">
            <div className="flex items-center gap-2">
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setExamFile(e.target.files?.[0] ?? null)} />
              {examFile && <Badge variant="outline" className="text-[10px]"><Upload className="h-3 w-3 mr-1" />{examFile.name}</Badge>}
            </div>
          </Field>
          <Field label="Observações" className="col-span-2 md:col-span-4"><Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2 md:col-span-4" disabled={create.isPending}><Plus className="h-4 w-4 mr-2" />Registrar exame</Button>
        </form>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Natureza</TableHead><TableHead>Realização</TableHead><TableHead>Vencimento</TableHead><TableHead>Aptidão</TableHead><TableHead>PDF</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {exams.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum exame</TableCell></TableRow>}
          {exams.map((ex: any) => (
            <TableRow key={ex.id}>
              <TableCell className="font-medium">{ex.tipo_exame}</TableCell>
              <TableCell>{ex.natureza}</TableCell>
              <TableCell>{formatDateBR(ex.data_realizacao)}</TableCell>
              <TableCell>{formatDateBR(ex.data_vencimento)}</TableCell>
              <TableCell><Badge variant={ex.aptidao === "SIM" ? "default" : "destructive"}>{ex.aptidao === "SIM" ? "APTO" : "INAPTO"}</Badge></TableCell>
              <TableCell>
                {ex.anexo_path ? (
                  <Button size="sm" variant="ghost" onClick={() => openExam(ex.anexo_path)}><FileText className="h-4 w-4 mr-1" />Ver</Button>
                ) : <span className="text-xs text-red-500 font-bold">Sem PDF</span>}
              </TableCell>
              <TableCell className="text-right">
                {canDelete && <Button size="icon" variant="ghost" onClick={() => del.mutate(ex)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
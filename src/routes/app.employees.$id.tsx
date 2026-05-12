import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { NRS_LIST, TIPOS_EXAME, NATUREZAS_EXAME, UFS, VACINAS_LIST, BAIRROS_MANAUS } from "@/lib/constants";
import { maskCPF, maskCNPJ, maskPhone, maskCEP, maskRG } from "@/lib/masks";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";
import { openFileViewer } from "@/components/file-viewer";
import { openEpiFichaPdf } from "@/lib/epi-ficha-pdf";
import { openTermoPerdaPdf } from "@/lib/epi-termo-perda-pdf";
import { HardHat, Printer, FileSignature, AlertCircle, Clock, FileWarning, Ban } from "lucide-react";

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
    queryKey: ["docs-summary", id],
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
          <div className="mt-1 text-base font-bold tracking-wide text-slate-700">
            CPF: <span className="font-mono">{emp.cpf ?? "—"}</span>
            <span className="mx-2 text-slate-300">·</span>
            <span className="text-[11px] uppercase tracking-widest text-slate-500">Matrícula {emp.matricula ?? "—"}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Função:</span>
              <span className="text-slate-800">{role?.name ?? "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admissão:</span>
              <span className="text-slate-800">
                {emp.admissao ? new Date(emp.admissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
              </span>
            </span>
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
        <TabsList className="grid grid-cols-5 w-full h-auto p-1.5 bg-gradient-to-r from-red-50 via-white to-red-50 border border-red-200/60 rounded-xl shadow-sm gap-1">
          {[
            { v: "profile", l: "Perfil" },
            { v: "nrs", l: "NRs" },
            { v: "docs", l: "Docs" },
            { v: "epi", l: "EPI" },
            { v: "health", l: "Saúde" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider text-slate-600 transition-all hover:text-red-700 data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-600 data-[state=active]:to-red-800 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-red-500/30"
            >
              {t.l}
            </TabsTrigger>
          ))}
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
        <Field label="CPF"><Input inputMode="numeric" maxLength={14} placeholder="000.000.000-00" value={maskCPF(f.cpf ?? "")} onChange={(e) => setF({ ...f, cpf: maskCPF(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Matrícula"><Input value={f.matricula ?? ""} onChange={(e) => setF({ ...f, matricula: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="RG"><Input placeholder="0000000" maxLength={12} value={maskRG(f.rg ?? "")} onChange={(e) => setF({ ...f, rg: maskRG(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Órgão Emissor"><Input value={f.rg_orgao ?? ""} onChange={(e) => setF({ ...f, rg_orgao: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="CNH"><Input inputMode="numeric" maxLength={11} placeholder="00000000000" value={(f.cnh ?? "").replace(/\D/g, "").slice(0, 11)} onChange={(e) => setF({ ...f, cnh: e.target.value.replace(/\D/g, "").slice(0, 11) })} disabled={!canEdit} /></Field>
        <Field label="Tipo cadastro">
          <Select value={f.tipo_cadastro} onValueChange={(v) => setF({ ...f, tipo_cadastro: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NAO_MEI">CLT/NÃO MEI</SelectItem>
              <SelectItem value="MEI">MEI</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CNPJ (MEI)"><Input inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" value={maskCNPJ(f.cnpj ?? "")} onChange={(e) => setF({ ...f, cnpj: maskCNPJ(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Admissão"><Input type="date" value={f.admissao ?? ""} onChange={(e) => setF({ ...f, admissao: e.target.value || null })} disabled={!canEdit} /></Field>
        <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="WhatsApp"><Input inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={maskPhone(f.whatsapp ?? "")} onChange={(e) => setF({ ...f, whatsapp: maskPhone(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="Contato Emergência"><Input value={f.nome_contato ?? ""} onChange={(e) => setF({ ...f, nome_contato: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="WhatsApp Emergência"><Input inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" value={maskPhone(f.whatsapp_emergencia ?? "")} onChange={(e) => setF({ ...f, whatsapp_emergencia: maskPhone(e.target.value) })} disabled={!canEdit} /></Field>
        <Field label="CEP">
          <Input
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            value={maskCEP(f.cep ?? "")}
            onChange={async (e) => {
              const masked = maskCEP(e.target.value);
              setF((prev: any) => ({ ...prev, cep: masked }));
              const digits = masked.replace(/\D/g, "");
              if (digits.length === 8) {
                try {
                  const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
                  const j = await r.json();
                  if (!j?.erro) {
                    setF((prev: any) => ({
                      ...prev,
                      endereco: prev.endereco || [j.logradouro, j.complemento].filter(Boolean).join(", "),
                      bairro: j.bairro || prev.bairro,
                      cidade: j.localidade || prev.cidade,
                      uf: j.uf || prev.uf,
                    }));
                  }
                } catch { /* ignore */ }
              }
            }}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Endereço" className="md:col-span-2"><Input value={f.endereco ?? ""} onChange={(e) => setF({ ...f, endereco: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="Bairro">
          <Select value={f.bairro ?? ""} onValueChange={(v) => setF({ ...f, bairro: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="Selecione o bairro" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {BAIRROS_MANAUS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cidade"><Input value={f.cidade ?? ""} onChange={(e) => setF({ ...f, cidade: e.target.value })} disabled={!canEdit} /></Field>
        <Field label="UF">
          <Select value={f.uf ?? ""} onValueChange={(v) => setF({ ...f, uf: v })} disabled={!canEdit}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
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
    queryFn: async () => (await supabase.from("employee_docs").select("*").eq("employee_id", empId).order("uploaded_at", { ascending: false })).data ?? [],
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
      qc.invalidateQueries({ queryKey: ["docs-summary", empId] });
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
      if (!d?.id || !d?.file_path) throw new Error("Documento inválido. Atualize a página e tente novamente.");
      await supabase.storage.from("employee-docs").remove([d.file_path]);
      const { error } = await supabase.from("employee_docs").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs", empId] }); qc.invalidateQueries({ queryKey: ["docs-summary", empId] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function openDoc(path: string) {
    if (!path) { toast.error("Documento sem arquivo vinculado. Atualize a página e tente novamente."); return; }
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
type EstoqueRow = {
  id: string;
  codigo_material: string;
  nome_material: string;
  ca: string | null;
  quantidade_atual: number;
};
function EpiTab({ empId, epis, emp, company, role, canEdit, canDelete, qc, docsOk, missingDocs }: any) {
  const { data: stockItems = [] } = useQuery({
    queryKey: ["estoque_epi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, codigo_material, nome_material, ca, quantidade_atual")
        .order("nome_material");
      if (error) throw error;
      return (data ?? []) as EstoqueRow[];
    },
  });

  type MotivoEntrega = "PRIMEIRA_ENTREGA" | "TROCA_DESGASTE" | "EMPRESTIMO" | "PERDA_EXTRAVIO";
  const MOTIVO_LABEL: Record<MotivoEntrega, string> = {
    PRIMEIRA_ENTREGA: "1ª Entrega",
    TROCA_DESGASTE: "Troca por desgaste/vencimento",
    EMPRESTIMO: "Empréstimo (uso temporário)",
    PERDA_EXTRAVIO: "Reposição por perda/extravio",
  };
  const MOTIVO_COLOR: Record<MotivoEntrega, string> = {
    PRIMEIRA_ENTREGA: "bg-emerald-500",
    TROCA_DESGASTE: "bg-blue-500",
    EMPRESTIMO: "bg-amber-500",
    PERDA_EXTRAVIO: "bg-rose-600",
  };

  const [f, setF] = useState<{
    epi_id: string; ca: string; qtd: string; data_entrega: string;
    motivo_entrega: MotivoEntrega; data_devolucao_prevista: string;
    valor_unitario: string; observacoes: string;
  }>({
    epi_id: "", ca: "", qtd: "1", data_entrega: new Date().toISOString().slice(0, 10),
    motivo_entrega: "PRIMEIRA_ENTREGA", data_devolucao_prevista: "",
    valor_unitario: "", observacoes: "",
  });
  const selected = stockItems.find((s) => s.id === f.epi_id) ?? null;
  const MOTIVOS_DEV = ["Danificado", "Desgaste Natural", "Extravio", "Mal Uso", "Furto", "Uso Temporário"];
  const [substitution, setSubstitution] = useState<{ prev: any; motivo: string; data: string; obs: string } | null>(null);

  // Alerta de reincidência: mesmo EPI entregue ao colaborador nos últimos 30 dias
  const reincidencia = (() => {
    if (!selected) return null;
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ant = (epis ?? []).find(
      (e: any) => norm(e.item) === norm(selected.nome_material) && new Date(e.data_entrega).getTime() >= cutoff,
    );
    return ant ?? null;
  })();

  function resetForm() {
    setF({
      epi_id: "", ca: "", qtd: "1", data_entrega: new Date().toISOString().slice(0, 10),
      motivo_entrega: "PRIMEIRA_ENTREGA", data_devolucao_prevista: "",
      valor_unitario: "", observacoes: "",
    });
  }

  /** Cria registro na ficha do colaborador + dá baixa no estoque (RPC). */
  async function insertNewDelivery() {
    if (!selected) throw new Error("Selecione um EPI do estoque");
    const qtd = Math.max(1, Number(f.qtd) || 1);
    if ((selected.quantidade_atual ?? 0) < qtd) {
      throw new Error(`Saldo insuficiente no estoque SESMT (atual: ${selected.quantidade_atual})`);
    }
    // 1) baixa atômica no estoque + log em historico_entregas
    const { error: rpcErr } = await supabase.rpc("registrar_entrega_epi", {
      _epi_id: selected.id,
      _cpf: emp?.cpf ?? "",
      _nome: emp?.nome ?? "",
      _qtd: qtd,
    });
    if (rpcErr) throw rpcErr;
    // 2) registro na ficha do colaborador
    const valor = f.valor_unitario ? Number(String(f.valor_unitario).replace(",", ".")) : null;
    const { error } = await supabase.from("epi_deliveries").insert({
      employee_id: empId,
      item: selected.nome_material,
      ca: (f.ca || selected.ca) || null,
      tamanho: null,
      qtd,
      data_entrega: f.data_entrega,
      motivo_entrega: f.motivo_entrega,
      data_devolucao_prevista: f.motivo_entrega === "EMPRESTIMO" && f.data_devolucao_prevista
        ? f.data_devolucao_prevista : null,
      valor_unitario: valor,
      observacoes: f.observacoes || null,
    } as any);
    if (error) throw error;

    // 3) Se for perda/extravio, gera termo de responsabilidade automaticamente
    if (f.motivo_entrega === "PERDA_EXTRAVIO") {
      const { url, fname } = openTermoPerdaPdf({
        emp, company, role,
        item: selected.nome_material,
        ca: (f.ca || selected.ca) || null,
        qtd,
        valor_unitario: valor,
        data_entrega: f.data_entrega,
        observacoes: f.observacoes,
      });
      openFileViewer({ url, name: fname, mime: "application/pdf" });
    }
  }

  const create = useMutation({
    mutationFn: insertNewDelivery,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      resetForm();
      toast.success("Entrega registrada e estoque atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const substituteMut = useMutation({
    mutationFn: async () => {
      if (!substitution) return;
      const obs = `Motivo: ${substitution.motivo}${substitution.obs ? ` — ${substitution.obs}` : ""}`;
      const { error: upErr } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: substitution.data, observacoes: obs })
        .eq("id", substitution.prev.id);
      if (upErr) throw upErr;
      // devolve o anterior ao estoque (se identificado)
      const prevItem = stockItems.find((s) => s.nome_material === substitution.prev.item);
      if (prevItem) {
        await supabase.rpc("registrar_movimentacao_epi", {
          _epi_id: prevItem.id,
          _qtd: Number(substitution.prev.qtd) || 1,
          _tipo: "DEVOLUCAO",
          _cpf: emp?.cpf ?? "",
          _nome: emp?.nome ?? "",
        });
      }
      await insertNewDelivery();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      resetForm();
      setSubstitution(null);
      toast.success("Substituição registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function submitDelivery() {
    if (!selected) return;
    // Só dispara o fluxo de substituição para "troca por desgaste".
    // Empréstimo, perda e 1ª entrega seguem direto (registram nova entrega).
    if (f.motivo_entrega === "TROCA_DESGASTE") {
      const norm = (s: any) => String(s ?? "").trim().toLowerCase();
      const prev = (epis ?? []).find(
        (e: any) => !e.data_devolucao && norm(e.item) === norm(selected.nome_material),
      );
      if (prev) {
        setSubstitution({ prev, motivo: "Desgaste Natural", data: f.data_entrega, obs: "" });
        return;
      }
    }
    create.mutate();
  }

  const del = useMutation({
    mutationFn: async (id: string) => {
      const target = (epis ?? []).find((e: any) => e.id === id);
      const { error } = await supabase.from("epi_deliveries").delete().eq("id", id);
      if (error) throw error;
      if (target && !target.data_devolucao) {
        const stockRow = stockItems.find((s) => s.nome_material === target.item);
        if (stockRow) {
          await supabase.rpc("registrar_movimentacao_epi", {
            _epi_id: stockRow.id,
            _qtd: Number(target.qtd) || 1,
            _tipo: "DEVOLUCAO",
            _cpf: emp?.cpf ?? "",
            _nome: emp?.nome ?? "",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [returning, setReturning] = useState<any | null>(null);
  const [retForm, setRetForm] = useState<{ motivo: string; data: string; obs: string }>({
    motivo: "Desgaste Natural", data: new Date().toISOString().slice(0, 10), obs: "",
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
      const stockRow = stockItems.find((s) => s.nome_material === returning.item);
      if (stockRow) {
        await supabase.rpc("registrar_movimentacao_epi", {
          _epi_id: stockRow.id,
          _qtd: Number(returning.qtd) || 1,
          _tipo: "DEVOLUCAO",
          _cpf: emp?.cpf ?? "",
          _nome: emp?.nome ?? "",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Devolução registrada");
      setReturning(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const undoReturn = useMutation({
    mutationFn: async (id: string) => {
      const target = (epis ?? []).find((e: any) => e.id === id);
      const { error } = await supabase
        .from("epi_deliveries")
        .update({ data_devolucao: null, observacoes: null })
        .eq("id", id);
      if (error) throw error;
      if (target) {
        const stockRow = stockItems.find((s) => s.nome_material === target.item);
        if (stockRow) {
          await supabase.rpc("registrar_entrega_epi", {
            _epi_id: stockRow.id,
            _cpf: emp?.cpf ?? "",
            _nome: emp?.nome ?? "",
            _qtd: Number(target.qtd) || 1,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epis", empId] });
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Devolução desfeita");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function gerarFicha() {
    if (!docsOk) {
      toast.warning(`Atenção: documentação pendente (${(missingDocs ?? []).join(", ")}). Ficha emitida mesmo assim.`);
    }
    const { url, fname } = openEpiFichaPdf({ emp, company, role, epis });
    openFileViewer({ url, name: fname, mime: "application/pdf" });
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-black uppercase tracking-wider text-brand">Controle de EPIs</h2>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Itens vinculados ao Estoque SESMT — saída automática ao registrar entrega
          </p>
        </div>
        <Button
          onClick={gerarFicha}
          title="Gerar Ficha de EPI"
          className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-xs"
          size="lg"
        >
          <Printer className="h-4 w-4 mr-2" /> Ficha em PDF
        </Button>
      </Card>

      {canEdit && (
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-brand" />
            <h3 className="text-xs font-black uppercase tracking-widest text-brand">Registrar entrega de EPI</h3>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); submitDelivery(); }} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-12 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da entrega</Label>
              <Select
                value={f.motivo_entrega}
                onValueChange={(v) => setF({ ...f, motivo_entrega: v as MotivoEntrega })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMEIRA_ENTREGA">🟢 1ª Entrega — colaborador nunca recebeu este item</SelectItem>
                  <SelectItem value="TROCA_DESGASTE">🔵 Troca por desgaste / vencimento — substitui o anterior</SelectItem>
                  <SelectItem value="EMPRESTIMO">🟡 Empréstimo — uso temporário, com previsão de devolução</SelectItem>
                  <SelectItem value="PERDA_EXTRAVIO">🔴 Reposição por perda / extravio — gera termo de responsabilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reincidencia && f.motivo_entrega === "PRIMEIRA_ENTREGA" && (
              <div className="md:col-span-12 rounded-lg border-2 border-amber-300 bg-amber-50 p-3 flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <div className="font-black uppercase tracking-wider">Atenção: possível reincidência</div>
                  <div className="mt-0.5">
                    Este colaborador já recebeu <strong>{reincidencia.item}</strong> em{" "}
                    <strong>{formatDateBR(reincidencia.data_entrega)}</strong>{" "}
                    ({Math.floor((Date.now() - new Date(reincidencia.data_entrega).getTime()) / 86400000)} dias atrás).
                    Verifique se o motivo correto não é <em>Troca</em>, <em>Empréstimo</em> ou <em>Perda</em>.
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição do EPI (do estoque SESMT)</Label>
              <Select
                value={f.epi_id}
                onValueChange={(v) => {
                  const prod = stockItems.find((s) => s.id === v);
                  setF({ ...f, epi_id: v, ca: prod?.ca ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={stockItems.length ? "Selecione um EPI…" : "Nenhum item cadastrado no Estoque SESMT"} />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Cadastre itens no Painel de Estoque SESMT</div>
                  ) : (
                    stockItems.map((s) => (
                      <SelectItem key={s.id} value={s.id} disabled={(s.quantidade_atual ?? 0) <= 0}>
                        {s.nome_material} {s.ca ? `(CA ${s.ca})` : ""} — saldo: {s.quantidade_atual}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">C.A.</Label>
              <Input value={f.ca} onChange={(e) => setF({ ...f, ca: e.target.value })} placeholder="—" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entrega</Label>
              <Input type="date" value={f.data_entrega} onChange={(e) => setF({ ...f, data_entrega: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">QTD</Label>
              <Input type="number" min="1" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} />
            </div>

            {f.motivo_entrega === "EMPRESTIMO" && (
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  <Clock className="h-3 w-3 inline mr-1" /> Devolução prevista
                </Label>
                <Input
                  type="date"
                  value={f.data_devolucao_prevista}
                  onChange={(e) => setF({ ...f, data_devolucao_prevista: e.target.value })}
                  className="border-amber-300"
                  required
                />
              </div>
            )}

            {f.motivo_entrega === "PERDA_EXTRAVIO" && (
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                  Valor unitário (p/ termo) R$
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={f.valor_unitario}
                  onChange={(e) => setF({ ...f, valor_unitario: e.target.value })}
                  className="border-rose-300"
                />
              </div>
            )}

            {(f.motivo_entrega === "EMPRESTIMO" || f.motivo_entrega === "PERDA_EXTRAVIO") && (
              <div className="md:col-span-12 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Observações {f.motivo_entrega === "PERDA_EXTRAVIO" && "(será impressa no termo)"}
                </Label>
                <Textarea
                  rows={2}
                  value={f.observacoes}
                  onChange={(e) => setF({ ...f, observacoes: e.target.value })}
                  placeholder={
                    f.motivo_entrega === "EMPRESTIMO"
                      ? "Ex: empréstimo para visita técnica do dia X"
                      : "Ex: B.O. nº 1234, perda no canteiro de obras…"
                  }
                />
              </div>
            )}

            <div className="md:col-span-12 flex justify-end">
              <Button
                type="submit"
                disabled={create.isPending || !f.epi_id || (f.motivo_entrega === "EMPRESTIMO" && !f.data_devolucao_prevista)}
                className={
                  f.motivo_entrega === "PERDA_EXTRAVIO" ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : f.motivo_entrega === "EMPRESTIMO" ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-brand text-white"
                }
              >
                {f.motivo_entrega === "PERDA_EXTRAVIO" ? <FileWarning className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {f.motivo_entrega === "PERDA_EXTRAVIO" ? "Registrar e gerar termo de perda"
                : f.motivo_entrega === "EMPRESTIMO" ? "Registrar empréstimo"
                : "Registrar entrega"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {(() => {
        const emprestimos = (epis ?? []).filter(
          (e: any) => e.motivo_entrega === "EMPRESTIMO" && !e.data_devolucao,
        );
        if (!emprestimos.length) return null;
        return (
          <Card className="p-5 rounded-2xl border-amber-300 bg-amber-50/40">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-amber-700" />
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-800">
                EPIs emprestados — aguardando devolução ({emprestimos.length})
              </h3>
            </div>
            <div className="space-y-2">
              {emprestimos.map((e: any) => {
                const venc = e.data_devolucao_prevista
                  ? Math.floor((new Date(e.data_devolucao_prevista).getTime() - Date.now()) / 86400000)
                  : null;
                const atrasado = venc !== null && venc < 0;
                return (
                  <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border ${atrasado ? "border-rose-300 bg-rose-50" : "border-amber-200 bg-white"}`}>
                    <Clock className={`h-5 w-5 ${atrasado ? "text-rose-600" : "text-amber-600"} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-slate-800 uppercase">{e.item} <span className="text-xs text-slate-500">(QTD: {e.qtd})</span></div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                        Entregue em {formatDateBR(e.data_entrega)} • Devolução prevista: {e.data_devolucao_prevista ? formatDateBR(e.data_devolucao_prevista) : "—"}
                        {venc !== null && (
                          <span className={`ml-2 ${atrasado ? "text-rose-700" : "text-amber-700"}`}>
                            ({atrasado ? `${Math.abs(venc)}d em atraso` : `faltam ${venc}d`})
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => openReturn(e)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Receber de volta
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

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
                  {e.motivo_entrega && (
                    <Badge className={`${MOTIVO_COLOR[e.motivo_entrega as MotivoEntrega] ?? "bg-slate-500"} text-white text-[10px]`}>
                      {MOTIVO_LABEL[e.motivo_entrega as MotivoEntrega] ?? e.motivo_entrega}
                    </Badge>
                  )}
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
                <div className="text-slate-500 mt-0.5">QTD: {returning.qtd} • Entregue em {formatDateBR(returning.data_entrega)}</div>
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

      <Dialog open={!!substitution} onOpenChange={(o) => !o && setSubstitution(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Substituição de EPI
            </DialogTitle>
          </DialogHeader>
          {substitution && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                Já existe uma entrega ativa de <strong className="uppercase">{substitution.prev.item}</strong> para este colaborador.
                Vamos finalizar a entrega anterior e registrar a nova.
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo da substituição</Label>
                <Select value={substitution.motivo} onValueChange={(v) => setSubstitution({ ...substitution, motivo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DEV.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data da devolução do anterior</Label>
                <Input type="date" value={substitution.data} onChange={(e) => setSubstitution({ ...substitution, data: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações (opcional)</Label>
                <Textarea rows={3} value={substitution.obs} onChange={(e) => setSubstitution({ ...substitution, obs: e.target.value })} placeholder="Detalhes adicionais (ex: B.O. do furto, etc.)" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubstitution(null)}>Cancelar</Button>
            <Button onClick={() => substituteMut.mutate()} disabled={substituteMut.isPending || !substitution?.data || !substitution?.motivo} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Confirmar substituição e entregar novo
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
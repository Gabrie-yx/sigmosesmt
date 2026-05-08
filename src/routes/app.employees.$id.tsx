import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { formatDateBR, addMonthsToDate } from "@/lib/utils-date";
import { NRS_LIST, TIPOS_EXAME, NATUREZAS_EXAME, UFS } from "@/lib/constants";

export const Route = createFileRoute("/app/employees/$id")({
  component: EmployeeDetail,
});

function EmployeeDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();

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

  const role = (roles ?? []).find((r: any) => r.id === emp?.role_id) ?? null;
  const status = emp ? calculateSafetyStatus(emp as any, role as any, (exams ?? []) as any) : null;

  if (!emp) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-brand">
          <Link to="/app/employees"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
      </div>

      <Card className="p-6 flex flex-wrap items-center gap-6 rounded-2xl border-slate-200 shadow-sm">
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

      {status && status.msgs.length > 0 && (
        <Card className="p-4 flex flex-wrap gap-2">
          {status.msgs.map((m, i) => (
            <Badge key={i} variant="outline">{m}</Badge>
          ))}
        </Card>
      )}

      <Tabs defaultValue="profile">
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
          <EpiTab empId={id} epis={epis ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <HealthTab empId={id} exams={exams ?? []} canEdit={isEditor} canDelete={isAdmin} qc={qc} />
        </TabsContent>
      </Tabs>
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
  const { data: docs } = useQuery({
    queryKey: ["docs", empId],
    queryFn: async () => (await supabase.from("employee_docs").select("*").eq("employee_id", empId)).data ?? [],
  });
  return (
    <Card className="p-6">
      <div className="text-sm text-muted-foreground mb-4">
        Upload de documentos pessoais (RG, CPF, comprovantes). Anexos vão para o bucket privado <code>employee-docs</code>.
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Arquivo</TableHead><TableHead>Enviado em</TableHead></TableRow></TableHeader>
        <TableBody>
          {(docs ?? []).length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center">Nenhum documento</TableCell></TableRow>}
          {(docs ?? []).map((d: any) => (
            <TableRow key={d.id}><TableCell>{d.tipo}</TableCell><TableCell className="font-mono text-xs">{d.file_path}</TableCell><TableCell>{formatDateBR(d.uploaded_at)}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ============ EPI ============ */
function EpiTab({ empId, epis, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>({ item: "", ca: "", tamanho: "", qtd: 1, data_entrega: new Date().toISOString().slice(0, 10) });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("epi_deliveries").insert({
        employee_id: empId, item: f.item, ca: f.ca || null, tamanho: f.tamanho || null,
        qtd: Number(f.qtd) || 1, data_entrega: f.data_entrega,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); setF({ item: "", ca: "", tamanho: "", qtd: 1, data_entrega: new Date().toISOString().slice(0, 10) }); toast.success("Entregue"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("epi_deliveries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epis", empId] }); toast.success("Removido"); },
  });

  return (
    <Card className="p-6 space-y-6">
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end border-b pb-4">
          <Field label="Item *"><Input required value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></Field>
          <Field label="CA"><Input value={f.ca} onChange={(e) => setF({ ...f, ca: e.target.value })} /></Field>
          <Field label="Tamanho"><Input value={f.tamanho} onChange={(e) => setF({ ...f, tamanho: e.target.value })} /></Field>
          <Field label="Qtd"><Input type="number" min="1" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} /></Field>
          <Field label="Data"><Input type="date" value={f.data_entrega} onChange={(e) => setF({ ...f, data_entrega: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2 md:col-span-5" disabled={create.isPending}><Plus className="h-4 w-4 mr-2" />Entregar EPI</Button>
        </form>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>CA</TableHead><TableHead>Tam.</TableHead><TableHead>Qtd</TableHead><TableHead>Entrega</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {epis.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center">Nenhum EPI entregue</TableCell></TableRow>}
          {epis.map((e: any) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.item}</TableCell>
              <TableCell>{e.ca ?? "—"}</TableCell>
              <TableCell>{e.tamanho ?? "—"}</TableCell>
              <TableCell>{e.qtd}</TableCell>
              <TableCell>{formatDateBR(e.data_entrega)}</TableCell>
              <TableCell className="text-right">
                {canDelete && <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ============ HEALTH ============ */
function HealthTab({ empId, exams, canEdit, canDelete, qc }: any) {
  const [f, setF] = useState<any>({
    tipo_exame: "ASO Clínico", natureza: "Periódico", periodicidade_meses: 12,
    data_realizacao: new Date().toISOString().slice(0, 10), data_vencimento: addMonthsToDate(new Date().toISOString().slice(0, 10), 12),
    aptidao: "SIM", observacoes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const venc = f.data_vencimento || addMonthsToDate(f.data_realizacao, Number(f.periodicidade_meses) || 12);
      const { error } = await supabase.from("employee_exams").insert({
        employee_id: empId, tipo_exame: f.tipo_exame, natureza: f.natureza,
        periodicidade_meses: Number(f.periodicidade_meses) || 12,
        data_realizacao: f.data_realizacao, data_vencimento: venc,
        aptidao: f.aptidao, observacoes: f.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); qc.invalidateQueries({ queryKey: ["employee", empId] }); toast.success("Exame registrado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("employee_exams").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", empId] }); toast.success("Removido"); },
  });

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
          <Field label="Observações" className="col-span-2"><Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
          <Button type="submit" className="col-span-2 md:col-span-4" disabled={create.isPending}><Plus className="h-4 w-4 mr-2" />Registrar exame</Button>
        </form>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Natureza</TableHead><TableHead>Realização</TableHead><TableHead>Vencimento</TableHead><TableHead>Aptidão</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {exams.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum exame</TableCell></TableRow>}
          {exams.map((ex: any) => (
            <TableRow key={ex.id}>
              <TableCell className="font-medium">{ex.tipo_exame}</TableCell>
              <TableCell>{ex.natureza}</TableCell>
              <TableCell>{formatDateBR(ex.data_realizacao)}</TableCell>
              <TableCell>{formatDateBR(ex.data_vencimento)}</TableCell>
              <TableCell><Badge variant={ex.aptidao === "SIM" ? "default" : "destructive"}>{ex.aptidao === "SIM" ? "APTO" : "INAPTO"}</Badge></TableCell>
              <TableCell className="text-right">
                {canDelete && <Button size="icon" variant="ghost" onClick={() => del.mutate(ex.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
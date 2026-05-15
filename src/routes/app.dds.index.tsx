import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, BookOpen, Users, Search, Calendar, Trash2, Eye, BarChart3, X, FileDown, Pencil, Upload, ClipboardList, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { DDSEvidencias } from "@/components/dds-evidencias";
import { DDSAttendeesEditor } from "@/components/dds-attendees-editor";
import { gerarFormularioSemanalDDS } from "@/lib/dds-formulario-semanal-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/dds/")({
  component: DDSPage,
});

type DDS = {
  id: string;
  data: string;
  hora: string | null;
  gestor_id: string | null;
  setor: string | null;
  tema_id: string | null;
  tema_livre: string | null;
  temas_ids: string[] | null;
  temas_livres: string[] | null;
  duracao_min: number;
  conteudo: string | null;
  participantes_esperados: number;
  participantes_presentes: number;
  aderencia: number;
  status: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function adColor(p: number) {
  if (p >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (p >= 70) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
}

function DDSPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<DDS | null>(null);
  const [editing, setEditing] = useState<DDS | null>(null);
  const [search, setSearch] = useState("");

  const { data: dds = [] } = useQuery({
    queryKey: ["dds-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dds").select("*").order("data", { ascending: false }).limit(200);
      if (error) throw error;
      return data as DDS[];
    },
  });

  const { data: temas = [] } = useQuery({
    queryKey: ["dds-temas-active"],
    queryFn: async () => (await supabase.from("dds_temas").select("id,codigo,titulo,categoria,criticidade").eq("ativo", true).order("titulo")).data ?? [],
  });

  const { data: gestores = [] } = useQuery({
    queryKey: ["dds-gestores-active"],
    queryFn: async () => (await supabase.from("dds_gestores").select("id,nome,setor").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-dds"],
    queryFn: async () => (await supabase.from("employees").select("id,nome,cpf").eq("status", "ATIVO").order("nome")).data ?? [],
  });

  const temaMap = useMemo(() => Object.fromEntries(temas.map((t: any) => [t.id, t])), [temas]);
  const gestorMap = useMemo(() => Object.fromEntries(gestores.map((g: any) => [g.id, g])), [gestores]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return dds;
    return dds.filter((d) => {
      const t: any = d.tema_id ? temaMap[d.tema_id] : null;
      const g: any = d.gestor_id ? gestorMap[d.gestor_id] : null;
      return (
        (t?.titulo ?? "").toLowerCase().includes(q) ||
        (d.tema_livre ?? "").toLowerCase().includes(q) ||
        (d.setor ?? "").toLowerCase().includes(q) ||
        (g?.nome ?? "").toLowerCase().includes(q)
      );
    });
  }, [dds, search, temaMap, gestorMap]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dds-list"] }); toast.success("DDS excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl md:text-2xl font-bold flex-1">Diálogos Diários de Segurança</h1>
        <Button asChild variant="outline" size="sm"><Link to="/app/dds/painel"><BarChart3 className="h-4 w-4 mr-1" />Painel</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/app/dds/temas"><BookOpen className="h-4 w-4 mr-1" />Temas</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/app/dds/gestores"><Users className="h-4 w-4 mr-1" />Gestores</Link></Button>
        {isEditor && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Novo DDS</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total (últimos 200)" value={dds.length} />
        <KPI label="Aderência média" value={`${(dds.reduce((s, d) => s + Number(d.aderencia || 0), 0) / Math.max(dds.length, 1)).toFixed(0)}%`} />
        <KPI label="Temas ativos" value={temas.length} />
        <KPI label="Gestores" value={gestores.length} />
      </div>

      <div className="bg-white border rounded-lg p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tema, gestor ou setor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b bg-slate-50">
          <div className="col-span-2">Data</div>
          <div className="col-span-4">Tema</div>
          <div className="col-span-2">Gestor / Setor</div>
          <div className="col-span-2 text-center">Presentes</div>
          <div className="col-span-1 text-center">Aderência</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>
        <div className="divide-y max-h-[60vh] overflow-auto">
          {filtered.map((d) => {
            const t: any = d.tema_id ? temaMap[d.tema_id] : null;
            const g: any = d.gestor_id ? gestorMap[d.gestor_id] : null;
            return (
              <div key={d.id} className="grid grid-cols-12 px-4 py-2.5 items-center text-sm hover:bg-slate-50">
                <div className="col-span-2">
                  <div className="font-semibold">{new Date(d.data + "T00:00").toLocaleDateString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">{d.hora?.slice(0, 5) ?? ""}</div>
                </div>
                <div className="col-span-4 min-w-0">
                  {(() => {
                    const ids = (d.temas_ids && d.temas_ids.length > 0) ? d.temas_ids : (d.tema_id ? [d.tema_id] : []);
                    const livres = (d.temas_livres && d.temas_livres.length > 0) ? d.temas_livres : (d.tema_livre ? [d.tema_livre] : []);
                    const titles = [
                      ...ids.map((id) => (temaMap[id] as any)?.titulo).filter(Boolean),
                      ...livres,
                    ];
                    return (
                      <>
                        <div className="font-medium truncate" title={titles.join(" · ")}>{titles[0] ?? "—"}{titles.length > 1 ? ` +${titles.length - 1}` : ""}</div>
                      </>
                    );
                  })()}
                </div>
                <div className="col-span-2 min-w-0">
                  <div className="font-medium truncate">{g?.nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.setor ?? "—"}</div>
                </div>
                <div className="col-span-2 text-center text-sm">{d.participantes_presentes} / {d.participantes_esperados}</div>
                <div className="col-span-1 text-center">
                  <Badge variant="outline" className={`border ${adColor(Number(d.aderencia))}`}>{Number(d.aderencia).toFixed(0)}%</Badge>
                </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setViewing(d)}><Eye className="h-4 w-4" /></Button>
                  {isEditor && <Button size="icon" variant="ghost" onClick={() => setEditing(d)}><Pencil className="h-4 w-4" /></Button>}
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir DDS?")) del.mutate(d.id); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground"><Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum DDS lançado</div>}
        </div>
      </div>

      {creating && (
        <NewDDSDialog
          open={creating}
          onClose={() => setCreating(false)}
          temas={temas as any}
          gestores={gestores as any}
          employees={employees as any}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["dds-list"] }); setCreating(false); }}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do DDS e evidências</DialogTitle></DialogHeader>
          {viewing && <DDSDetail dds={viewing} temaMap={temaMap} gestorMap={gestorMap} />}
        </DialogContent>
      </Dialog>

      {editing && (
        <EditDDSDialog
          open={!!editing}
          dds={editing}
          temas={temas as any}
          gestores={gestores as any}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["dds-list"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function DDSDetail({ dds, temaMap, gestorMap }: { dds: DDS; temaMap: any; gestorMap: any }) {
  const g: any = dds.gestor_id ? gestorMap[dds.gestor_id] : null;
  const ids = (dds.temas_ids && dds.temas_ids.length > 0) ? dds.temas_ids : (dds.tema_id ? [dds.tema_id] : []);
  const livres = (dds.temas_livres && dds.temas_livres.length > 0) ? dds.temas_livres : (dds.tema_livre ? [dds.tema_livre] : []);

  const { data: attendees = [] } = useQuery({
    queryKey: ["dds-att", dds.id],
    queryFn: async () => (await supabase.from("dds_attendees").select("*, employees(nome)").eq("dds_id", dds.id)).data ?? [],
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Data" value={new Date(dds.data + "T00:00").toLocaleDateString("pt-BR")} />
        <Field label="Hora" value={dds.hora?.slice(0, 5) ?? "—"} />
        <Field label="Gestor" value={g?.nome ?? "—"} />
        <Field label="Setor" value={dds.setor ?? "—"} />
        <Field label="Temas" value={[...ids.map((id) => (temaMap[id] as any)?.titulo).filter(Boolean), ...livres].join(" · ") || "—"} />
        <Field label="Duração" value={`${dds.duracao_min} min`} />
        <Field label="Esperados" value={String(dds.participantes_esperados)} />
        <Field label="Presentes" value={`${dds.participantes_presentes} (${Number(dds.aderencia).toFixed(0)}%)`} />
      </div>
      {dds.conteudo && (
        <div>
          <div className="text-xs font-bold uppercase text-slate-500 mb-1">Conteúdo</div>
          <div className="text-sm bg-slate-50 border rounded p-3 whitespace-pre-wrap">{dds.conteudo}</div>
        </div>
      )}
      <div>
        <div className="text-xs font-bold uppercase text-slate-500 mb-1">Participantes ({attendees.length})</div>
        <div className="border rounded max-h-48 overflow-auto divide-y">
          {attendees.map((a: any) => (
            <div key={a.id} className="px-3 py-1.5 text-sm flex justify-between">
              <span>{a.employees?.nome ?? "—"}</span>
              <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
            </div>
          ))}
          {attendees.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">Sem registro</div>}
        </div>
      </div>
      <DDSEvidencias ddsId={dds.id} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function NewDDSDialog({ open, onClose, temas, gestores, employees, onSaved }: {
  open: boolean;
  onClose: () => void;
  temas: { id: string; codigo: number | null; titulo: string; categoria: string; criticidade: string }[];
  gestores: { id: string; nome: string; setor: string | null }[];
  employees: { id: string; nome: string; cpf: string | null }[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState(today());
  const [hora, setHora] = useState("07:30");
  const [horaFim, setHoraFim] = useState("07:40");
  const [gestorId, setGestorId] = useState<string>("");
  const [setor, setSetor] = useState("");
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [encarregado, setEncarregado] = useState("");
  const [sesmt, setSesmt] = useState("");
  const [temaIds, setTemaIds] = useState<string[]>([]);
  const [temasLivres, setTemasLivres] = useState<string[]>([]);
  const [temaLivreInput, setTemaLivreInput] = useState("");
  const [temaSearch, setTemaSearch] = useState("");
  const [duracao, setDuracao] = useState(10);
  const [conteudo, setConteudo] = useState("");
  const [esperados, setEsperados] = useState(0);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [empSearch, setEmpSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [gerarPdf, setGerarPdf] = useState(true);
  const [listaFile, setListaFile] = useState<File | null>(null);
  const [fotosFiles, setFotosFiles] = useState<File[]>([]);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewFromSave, setPreviewFromSave] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-for-dds-novo"],
    queryFn: async () => (await supabase.from("companies").select("id,name,cnpj,encarregado1,matriz_nome,matriz_cnpj").order("name")).data ?? [],
  });
  const { data: empresaEmployees = [] } = useQuery({
    queryKey: ["employees-by-companies-dds", companyIds.join(",")],
    enabled: companyIds.length > 0,
    queryFn: async () => (await supabase.from("employees").select("id,nome,cpf,company_id,roles(name)").eq("status","ATIVO").in("company_id", companyIds).order("nome")).data ?? [],
  });
  const selectedCompanies = useMemo(() => companies.filter((c: any) => companyIds.includes(c.id)), [companies, companyIds]);
  const primaryCompany = selectedCompanies[0];

  const empList = companyIds.length > 0 ? empresaEmployees as any[] : employees as any[];
  // ao trocar empresas: pré-marcar todos como presentes e ajustar esperados
  useMemo(() => {
    if (companyIds.length > 0 && empresaEmployees.length > 0) {
      setPresentes(new Set(empresaEmployees.map((e: any) => e.id)));
      setEsperados(empresaEmployees.length);
      if (primaryCompany?.encarregado1 && !encarregado) setEncarregado(primaryCompany.encarregado1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyIds.join(","), empresaEmployees.length]);

  useMemo(() => {
    if (!sesmt && user?.user_metadata?.full_name) setSesmt(user.user_metadata.full_name as string);
    else if (!sesmt && user?.email) setSesmt(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredEmp = useMemo(() => {
    const q = empSearch.toLowerCase().trim();
    if (!q) return empList;
    return empList.filter((e: any) => e.nome.toLowerCase().includes(q));
  }, [empList, empSearch]);

  function toggleEmp(id: string) {
    const next = new Set(presentes);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPresentes(next);
  }

  function getMonday(s: string) {
    const d = new Date(s + "T00:00");
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
  }
  function fmtBR(d: Date) { return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
  function fmtBRFull(d: Date) { return d.toLocaleDateString("pt-BR"); }

  function buildPDFSemanal(): { doc: jsPDF; name: string } | null {
    if (selectedCompanies.length === 0) return null;
    const seg = getMonday(data);
    const sex = new Date(seg); sex.setDate(sex.getDate() + 4);
    const temasSel = temaIds
      .map((id) => temas.find((t) => t.id === id))
      .filter(Boolean)
      .map((t: any) => `${t!.codigo ? t!.codigo + "- " : ""}${t!.titulo}`)
      .join(" / ");
    const assuntos = [temasSel, ...temasLivres].filter(Boolean).join(" / ") || "—";
    let doc: jsPDF | undefined;
    selectedCompanies.forEach((company: any, idx: number) => {
      const funcs = (empresaEmployees as any[])
        .filter((e) => e.company_id === company.id)
        .map((e) => ({ nome: e.nome, funcao: e.roles?.name ?? "" }));
      doc = gerarFormularioSemanalDDS({
        matrizNome: company?.matriz_nome || company?.name || "—",
        matrizCnpj: company?.matriz_cnpj || company?.cnpj || "",
        codigo: "FOR-SEG 06",
        revisao: "00",
        dataDocumento: new Date().toLocaleDateString("pt-BR"),
        pagina: `${String(idx + 1).padStart(2, "0")}/${String(selectedCompanies.length).padStart(2, "0")}`,
        empresaNome: company?.name ?? "",
        empresaCnpj: company?.cnpj ?? "",
        localSetor: setor || "—",
        periodoTexto: `${fmtBR(seg)} à ${fmtBRFull(sex)}`,
        horaTexto: `${(hora || "").replace(":", "h")}min às ${(horaFim || "").replace(":", "h")}min`,
        assuntos,
        funcionarios: funcs,
        encarregado, responsavelSesmt: sesmt,
      }, doc);
    });
    const baseName = selectedCompanies.length === 1
      ? (selectedCompanies[0].name ?? "empresa").replace(/\s+/g, "_")
      : `${selectedCompanies.length}_empresas`;
    const name = `DDS_${baseName}_${seg.toISOString().slice(0, 10)}.pdf`;
    return { doc: doc!, name };
  }

  async function save() {
    if (!gestorId) return toast.error("Selecione o gestor");
    if (gerarPdf && companyIds.length === 0) return toast.error("Selecione ao menos uma empresa para gerar o PDF semanal");
    if (temaIds.length === 0 && temasLivres.length === 0) return toast.error("Selecione ao menos um tema ou adicione um tema livre");
    if (!listaFile) toast.warning("Atenção: salvando sem lista de presença assinada");
    if (fotosFiles.length < 2) toast.warning(`Atenção: salvando com ${fotosFiles.length} foto(s) — recomendado 2 a 4`);
    if (fotosFiles.length > 4) return toast.error("Máximo de 4 fotos por DDS");
    setSaving(true);
    try {
      const { data: created, error } = await supabase.from("dds").insert({
        data, hora, hora_fim: horaFim || null,
        gestor_id: gestorId, setor: setor || null,
        company_id: companyIds[0] || null,
        encarregado: encarregado || null,
        responsavel_sesmt: sesmt || null,
        tema_id: temaIds[0] ?? null,
        tema_livre: temasLivres[0] ?? null,
        temas_ids: temaIds,
        temas_livres: temasLivres,
        duracao_min: duracao, conteudo: conteudo || null,
        participantes_esperados: esperados, participantes_presentes: presentes.size,
      }).select("id").single();
      if (error) throw error;
      if (!created) throw new Error("Falha ao criar DDS");
      if (presentes.size > 0) {
        const rows = Array.from(presentes).map((eid) => ({ dds_id: created.id, employee_id: eid, status: "PRESENTE" }));
        const { error: e2 } = await supabase.from("dds_attendees").insert(rows);
        if (e2) throw e2;
      }
      // Upload das evidências
      const ddsId = created.id;
      async function uploadOne(file: File, tipo: "LISTA_PRESENCA" | "FOTO_DDS") {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${ddsId}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
        const { error: ue } = await supabase.storage.from("dds-anexos").upload(path, file);
        if (ue) throw ue;
        const { error: ie } = await supabase.from("dds_evidencias").insert({
          dds_id: ddsId, file_path: path, tipo, descricao: file.name,
        });
        if (ie) throw ie;
      }
      try {
        if (listaFile) await uploadOne(listaFile, "LISTA_PRESENCA");
        for (const f of fotosFiles) await uploadOne(f, "FOTO_DDS");
      } catch (upErr: any) {
        toast.error("DDS salvo, mas falhou anexo: " + upErr.message);
      }
      if (gerarPdf && companyIds.length > 0) {
        try {
          const built = buildPDFSemanal();
          if (built) {
            setPreviewDoc(built.doc);
            setPreviewName(built.name);
            setPreviewFromSave(true);
          }
        } catch (err: any) { toast.error("DDS salvo, mas falhou ao gerar PDF: " + err.message); }
      }
      toast.success("DDS lançado");
      // Não fechar até o usuário concluir o preview; se não há PDF, fecha
      if (!gerarPdf || companyIds.length === 0) onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Novo DDS — gera formulário semanal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><Label>Data *</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora início</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><Label>Hora fim</Label><Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 10)} /></div>
            <div><Label>Esperados</Label><Input type="number" value={esperados} onChange={(e) => setEsperados(Number(e.target.value) || 0)} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Empresas * (uma página de PDF por empresa)</Label>
              {companyIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1 mt-1">
                  {selectedCompanies.map((c: any) => (
                    <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                      <span className="truncate max-w-[200px]">{c.name}</span>
                      <button type="button" onClick={() => setCompanyIds(companyIds.filter((x) => x !== c.id))} className="hover:bg-slate-300 rounded p-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="border rounded max-h-32 overflow-auto divide-y">
                {companies.map((c: any) => {
                  const checked = companyIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => setCompanyIds(checked ? companyIds.filter((x) => x !== c.id) : [...companyIds, c.id])} />
                      <span className="flex-1 truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
              {companyIds.length > 0 && <div className="text-xs text-muted-foreground mt-1">{empresaEmployees.length} funcionário(s) ativo(s) em {companyIds.length} empresa(s)</div>}
            </div>
            <div><Label>Local / Setor</Label><Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: PRODUÇÃO" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Gestor *</Label>
              <Select value={gestorId} onValueChange={(v) => {
                setGestorId(v);
                const g = gestores.find((x) => x.id === v);
                if (g?.setor && !setor) setSetor(g.setor);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {gestores.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}{g.setor ? ` — ${g.setor}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              {gestores.length === 0 && (
                <div className="text-xs text-amber-600 mt-1">
                  Nenhum gestor cadastrado. <Link to="/app/dds/gestores" className="underline">Cadastrar agora</Link>
                </div>
              )}
            </div>
            <div><Label>Encarregado / Designado</Label><Input value={encarregado} onChange={(e) => setEncarregado(e.target.value)} placeholder="Nome do encarregado" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Responsável SESMT</Label><Input value={sesmt} onChange={(e) => setSesmt(e.target.value)} /></div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={gerarPdf} onCheckedChange={(v) => setGerarPdf(Boolean(v))} />
                <FileDown className="h-4 w-4" /> Gerar formulário semanal (PDF) ao salvar
              </label>
            </div>
          </div>

          <div>
            <Label>Temas * ({temaIds.length + temasLivres.length} selecionado{temaIds.length + temasLivres.length === 1 ? "" : "s"})</Label>
            {(temaIds.length > 0 || temasLivres.length > 0) && (
              <div className="flex flex-wrap gap-1 mb-2 mt-1">
                {temaIds.map((id) => {
                  const t = temas.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      <span className="truncate max-w-[280px]">{t.codigo ? `${t.codigo}. ` : ""}{t.titulo}</span>
                      <button type="button" onClick={() => setTemaIds(temaIds.filter((x) => x !== id))} className="hover:bg-slate-300 rounded p-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  );
                })}
                {temasLivres.map((tl, i) => (
                  <Badge key={`l-${i}`} variant="outline" className="gap-1 pr-1 border-amber-400 text-amber-800">
                    <span className="truncate max-w-[280px]">{tl}</span>
                    <button type="button" onClick={() => setTemasLivres(temasLivres.filter((_, idx) => idx !== i))} className="hover:bg-amber-100 rounded p-0.5"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
            <Input placeholder="Buscar tema na biblioteca..." value={temaSearch} onChange={(e) => setTemaSearch(e.target.value)} className="mb-2" />
            <div className="border rounded max-h-48 overflow-auto divide-y">
              {temas
                .filter((t) => {
                  const q = temaSearch.toLowerCase().trim();
                  if (!q) return true;
                  return t.titulo.toLowerCase().includes(q) || String(t.codigo ?? "").includes(q);
                })
                .slice(0, 100)
                .map((t) => {
                  const checked = temaIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => setTemaIds(checked ? temaIds.filter((x) => x !== t.id) : [...temaIds, t.id])} />
                      <span className="flex-1 truncate">{t.codigo ? `${t.codigo}. ` : ""}{t.titulo}</span>
                      <Badge variant="outline" className="text-[9px] py-0">{t.criticidade}</Badge>
                    </label>
                  );
                })}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={temaLivreInput}
                onChange={(e) => setTemaLivreInput(e.target.value)}
                placeholder="Adicionar tema livre (fora da biblioteca)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = temaLivreInput.trim();
                    if (v) { setTemasLivres([...temasLivres, v]); setTemaLivreInput(""); }
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => {
                const v = temaLivreInput.trim();
                if (v) { setTemasLivres([...temasLivres, v]); setTemaLivreInput(""); }
              }}>Adicionar</Button>
            </div>
          </div>

          <div>
            <Label>Conteúdo / Pontos abordados</Label>
            <Textarea rows={3} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Presentes ({presentes.size})</Label>
              <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setPresentes(new Set(filteredEmp.map((e) => e.id)))}>Marcar todos visíveis</button>
            </div>
            <Input placeholder="Buscar funcionário..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="mb-2" />
            <div className="border rounded max-h-56 overflow-auto divide-y">
              {filteredEmp.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                  <Checkbox checked={presentes.has(e.id)} onCheckedChange={() => toggleEmp(e.id)} />
                  <span className="flex-1">{e.nome}</span>
                  {e.cpf && <span className="text-xs text-muted-foreground">{e.cpf}</span>}
                </label>
              ))}
              {filteredEmp.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">Nenhum funcionário</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border rounded p-2">
              <Label className="text-xs flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />Lista de presença assinada</Label>
              <div className="text-[10px] text-muted-foreground mb-1">1 arquivo (PDF ou foto da folha).</div>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setListaFile(e.target.files?.[0] ?? null)} />
              {listaFile && (
                <div className="mt-1 text-xs flex items-center gap-2">
                  <span className="truncate flex-1">{listaFile.name}</span>
                  <button type="button" onClick={() => setListaFile(null)} className="text-red-600 hover:underline">remover</button>
                </div>
              )}
            </div>
            <div className="border rounded p-2">
              <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />Fotos do DDS ({fotosFiles.length}/4)</Label>
              <div className="text-[10px] text-muted-foreground mb-1">2 a 4 fotos do momento.</div>
              <Input type="file" accept="image/*" multiple onChange={(e) => {
                const novos = Array.from(e.target.files ?? []);
                const total = [...fotosFiles, ...novos].slice(0, 4);
                if (fotosFiles.length + novos.length > 4) toast.warning("Limitado a 4 fotos");
                setFotosFiles(total);
                e.target.value = "";
              }} />
              {fotosFiles.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {fotosFiles.map((f, i) => (
                    <div key={i} className="text-xs flex items-center gap-2">
                      <span className="truncate flex-1">{f.name}</span>
                      <button type="button" onClick={() => setFotosFiles(fotosFiles.filter((_, idx) => idx !== i))} className="text-red-600 hover:underline">remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {gerarPdf && companyIds.length > 0 && (
            <Button variant="outline" type="button" onClick={() => {
              try {
                const built = buildPDFSemanal();
                if (built) { setPreviewDoc(built.doc); setPreviewName(built.name); setPreviewFromSave(false); }
              } catch (err: any) { toast.error(err.message); }
            }}><Eye className="h-4 w-4 mr-1" />Pré-visualizar PDF</Button>
          )}
          <Button onClick={save} disabled={saving}>Salvar DDS</Button>
        </DialogFooter>
      </DialogContent>
      <PDFPreviewDialog
        open={!!previewDoc}
        doc={previewDoc}
        fileName={previewName}
        onClose={() => { setPreviewDoc(null); if (previewFromSave) { setPreviewFromSave(false); onSaved(); } }}
      />
    </Dialog>
  );
}

function EditDDSDialog({ open, dds, temas, gestores, onClose, onSaved }: {
  open: boolean;
  dds: DDS;
  temas: { id: string; codigo: number | null; titulo: string; categoria: string; criticidade: string }[];
  gestores: { id: string; nome: string; setor: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState(dds.data);
  const [hora, setHora] = useState(dds.hora?.slice(0, 5) ?? "");
  const [gestorId, setGestorId] = useState<string>(dds.gestor_id ?? "");
  const [setor, setSetor] = useState(dds.setor ?? "");
  const [duracao, setDuracao] = useState(dds.duracao_min);
  const [esperados, setEsperados] = useState(dds.participantes_esperados);
  const [conteudo, setConteudo] = useState(dds.conteudo ?? "");
  const [temaIds, setTemaIds] = useState<string[]>(
    (dds.temas_ids && dds.temas_ids.length > 0) ? dds.temas_ids : (dds.tema_id ? [dds.tema_id] : []),
  );
  const [temasLivres, setTemasLivres] = useState<string[]>(
    (dds.temas_livres && dds.temas_livres.length > 0) ? dds.temas_livres : (dds.tema_livre ? [dds.tema_livre] : []),
  );
  const [temaLivreInput, setTemaLivreInput] = useState("");
  const [temaSearch, setTemaSearch] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!gestorId) return toast.error("Selecione o gestor");
    if (temaIds.length === 0 && temasLivres.length === 0) return toast.error("Selecione ao menos um tema");
    setSaving(true);
    try {
      const { error } = await supabase.from("dds").update({
        data, hora: hora || null, gestor_id: gestorId, setor: setor || null,
        tema_id: temaIds[0] ?? null,
        tema_livre: temasLivres[0] ?? null,
        temas_ids: temaIds,
        temas_livres: temasLivres,
        duracao_min: duracao, conteudo: conteudo || null,
        participantes_esperados: esperados,
      }).eq("id", dds.id);
      if (error) throw error;
      toast.success("DDS atualizado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Editar DDS</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Data *</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><Label>Duração (min)</Label><Input type="number" value={duracao} onChange={(e) => setDuracao(Number(e.target.value) || 10)} /></div>
            <div><Label>Esperados</Label><Input type="number" value={esperados} onChange={(e) => setEsperados(Number(e.target.value) || 0)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Gestor *</Label>
              <Select value={gestorId} onValueChange={setGestorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {gestores.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}{g.setor ? ` — ${g.setor}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Setor / Local</Label><Input value={setor} onChange={(e) => setSetor(e.target.value)} /></div>
          </div>
          <div>
            <Label>Temas * ({temaIds.length + temasLivres.length})</Label>
            {(temaIds.length > 0 || temasLivres.length > 0) && (
              <div className="flex flex-wrap gap-1 mb-2 mt-1">
                {temaIds.map((id) => {
                  const t = temas.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      <span className="truncate max-w-[280px]">{t.codigo ? `${t.codigo}. ` : ""}{t.titulo}</span>
                      <button type="button" onClick={() => setTemaIds(temaIds.filter((x) => x !== id))} className="hover:bg-slate-300 rounded p-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  );
                })}
                {temasLivres.map((tl, i) => (
                  <Badge key={`l-${i}`} variant="outline" className="gap-1 pr-1 border-amber-400 text-amber-800">
                    <span className="truncate max-w-[280px]">{tl}</span>
                    <button type="button" onClick={() => setTemasLivres(temasLivres.filter((_, idx) => idx !== i))} className="hover:bg-amber-100 rounded p-0.5"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
            <Input placeholder="Buscar tema na biblioteca..." value={temaSearch} onChange={(e) => setTemaSearch(e.target.value)} className="mb-2" />
            <div className="border rounded max-h-40 overflow-auto divide-y">
              {temas
                .filter((t) => {
                  const q = temaSearch.toLowerCase().trim();
                  if (!q) return true;
                  return t.titulo.toLowerCase().includes(q) || String(t.codigo ?? "").includes(q);
                })
                .slice(0, 100)
                .map((t) => {
                  const checked = temaIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => setTemaIds(checked ? temaIds.filter((x) => x !== t.id) : [...temaIds, t.id])} />
                      <span className="flex-1 truncate">{t.codigo ? `${t.codigo}. ` : ""}{t.titulo}</span>
                    </label>
                  );
                })}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={temaLivreInput} onChange={(e) => setTemaLivreInput(e.target.value)} placeholder="Adicionar tema livre"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = temaLivreInput.trim();
                    if (v) { setTemasLivres([...temasLivres, v]); setTemaLivreInput(""); }
                  }
                }} />
              <Button type="button" variant="outline" onClick={() => {
                const v = temaLivreInput.trim();
                if (v) { setTemasLivres([...temasLivres, v]); setTemaLivreInput(""); }
              }}>Adicionar</Button>
            </div>
          </div>
          <div>
            <Label>Conteúdo / Pontos abordados</Label>
            <Textarea rows={3} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          </div>
          <div>
            <Label>Lista de presentes</Label>
            <div className="text-[11px] text-muted-foreground mb-1">
              Marque/desmarque quem realmente participou. Ao salvar aqui, o total de presentes e a aderência são recalculados automaticamente.
            </div>
            <DDSAttendeesEditor ddsId={dds.id} esperados={esperados} />
          </div>
          <div>
            <Label>Evidências (lista de presença assinada e fotos)</Label>
            <div className="text-[11px] text-muted-foreground mb-1">
              Suba o PDF/foto da lista assinada e de 2 a 4 fotos do momento do DDS.
            </div>
            <DDSEvidencias ddsId={dds.id} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
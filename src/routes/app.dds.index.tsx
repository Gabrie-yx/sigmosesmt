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
import { Plus, BookOpen, Users, Search, Calendar, Trash2, Eye, BarChart3, X } from "lucide-react";
import { toast } from "sonner";

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
                  <div className="font-medium truncate">{t?.titulo ?? d.tema_livre ?? "—"}</div>
                  {t && (
                    <div className="flex gap-1 mt-0.5">
                      <Badge variant="secondary" className="text-[9px] py-0">{t.categoria}</Badge>
                      <Badge variant="outline" className="text-[9px] py-0">{t.criticidade}</Badge>
                    </div>
                  )}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalhes do DDS</DialogTitle></DialogHeader>
          {viewing && <DDSDetail dds={viewing} temaMap={temaMap} gestorMap={gestorMap} />}
        </DialogContent>
      </Dialog>
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
  const t: any = dds.tema_id ? temaMap[dds.tema_id] : null;
  const g: any = dds.gestor_id ? gestorMap[dds.gestor_id] : null;

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
        <Field label="Tema" value={t?.titulo ?? dds.tema_livre ?? "—"} />
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
  const [data, setData] = useState(today());
  const [hora, setHora] = useState("07:30");
  const [gestorId, setGestorId] = useState<string>("");
  const [setor, setSetor] = useState("");
  const [temaId, setTemaId] = useState<string>("");
  const [temaLivre, setTemaLivre] = useState("");
  const [duracao, setDuracao] = useState(10);
  const [conteudo, setConteudo] = useState("");
  const [esperados, setEsperados] = useState(employees.length);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [empSearch, setEmpSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredEmp = useMemo(() => {
    const q = empSearch.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter((e) => e.nome.toLowerCase().includes(q));
  }, [employees, empSearch]);

  function toggleEmp(id: string) {
    const next = new Set(presentes);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPresentes(next);
  }

  async function save() {
    if (!gestorId) return toast.error("Selecione o gestor");
    if (!temaId && !temaLivre.trim()) return toast.error("Selecione um tema ou digite um tema livre");
    setSaving(true);
    try {
      const { data: created, error } = await supabase.from("dds").insert({
        data, hora, gestor_id: gestorId, setor: setor || null,
        tema_id: temaId || null, tema_livre: temaId ? null : (temaLivre.trim() || null),
        duracao_min: duracao, conteudo: conteudo || null,
        participantes_esperados: esperados, participantes_presentes: presentes.size,
      }).select("id").single();
      if (error) throw error;
      if (presentes.size > 0) {
        const rows = Array.from(presentes).map((eid) => ({ dds_id: created.id, employee_id: eid, status: "PRESENTE" }));
        const { error: e2 } = await supabase.from("dds_attendees").insert(rows);
        if (e2) throw e2;
      }
      toast.success("DDS lançado");
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
        <DialogHeader><DialogTitle>Novo DDS</DialogTitle></DialogHeader>
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
            <div>
              <Label>Setor / Local</Label>
              <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex: PCP, Expedição..." />
            </div>
          </div>

          <div>
            <Label>Tema *</Label>
            <Select value={temaId} onValueChange={setTemaId}>
              <SelectTrigger><SelectValue placeholder="Selecione da biblioteca..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {temas.map((t) => <SelectItem key={t.id} value={t.id}>{t.codigo ? `${t.codigo}. ` : ""}{t.titulo} [{t.criticidade}]</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1">Ou digite tema livre:</div>
            <Input value={temaLivre} onChange={(e) => setTemaLivre(e.target.value)} placeholder="Tema fora da biblioteca" disabled={!!temaId} />
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar DDS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
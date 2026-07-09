import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Syringe, ChevronLeft, Search, Plus, Trash2, Pencil, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/catalogos/vacinas")({
  component: VacinasPage,
  head: () => ({
    meta: [
      { title: "Vacinas Ocupacionais (PNI) — SIGMO" },
      { name: "description", content: "Catálogo de vacinas ocupacionais aplicado a SST — NR-07 e PNI Ministério da Saúde." },
    ],
  }),
});

type Vacina = {
  id: string;
  nome: string;
  nome_comercial: string | null;
  doses_recomendadas: number;
  intervalo_doses: string | null;
  via_aplicacao: string | null;
  indicacao_ocupacional: string | null;
  contraindicacoes: string | null;
  origem: "PNI" | "PRIVADA" | "AMBAS";
  reforco_periodicidade: string | null;
  codigo_esocial: string | null;
  riscos_relacionados: string[] | null;
  categorias_profissionais: string[] | null;
  observacoes: string | null;
  ativo: boolean;
};

type FormState = Omit<Vacina, "id" | "riscos_relacionados" | "categorias_profissionais"> & {
  riscos_relacionados_text: string;
  categorias_profissionais_text: string;
};

const emptyForm: FormState = {
  nome: "",
  nome_comercial: "",
  doses_recomendadas: 1,
  intervalo_doses: "",
  via_aplicacao: "",
  indicacao_ocupacional: "",
  contraindicacoes: "",
  origem: "PNI",
  reforco_periodicidade: "",
  codigo_esocial: "",
  riscos_relacionados_text: "",
  categorias_profissionais_text: "",
  observacoes: "",
  ativo: true,
};

function VacinasPage() {
  const [q, setQ] = useState("");
  const [origem, setOrigem] = useState<"todos" | "PNI" | "PRIVADA" | "AMBAS">("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vacina | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["catalogo-vacinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vacina_catalog").select("*").order("nome");
      if (error) throw error;
      return data as Vacina[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return data.filter((v) => {
      if (origem !== "todos" && v.origem !== origem) return false;
      if (!s) return true;
      return (
        v.nome.toLowerCase().includes(s) ||
        (v.indicacao_ocupacional ?? "").toLowerCase().includes(s) ||
        (v.categorias_profissionais ?? []).some((c) => c.toLowerCase().includes(s))
      );
    });
  }, [data, q, origem]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(v: Vacina) {
    setEditing(v);
    setForm({
      nome: v.nome,
      nome_comercial: v.nome_comercial ?? "",
      doses_recomendadas: v.doses_recomendadas,
      intervalo_doses: v.intervalo_doses ?? "",
      via_aplicacao: v.via_aplicacao ?? "",
      indicacao_ocupacional: v.indicacao_ocupacional ?? "",
      contraindicacoes: v.contraindicacoes ?? "",
      origem: v.origem,
      reforco_periodicidade: v.reforco_periodicidade ?? "",
      codigo_esocial: v.codigo_esocial ?? "",
      riscos_relacionados_text: (v.riscos_relacionados ?? []).join(", "),
      categorias_profissionais_text: (v.categorias_profissionais ?? []).join(", "),
      observacoes: v.observacoes ?? "",
      ativo: v.ativo,
    });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        nome_comercial: form.nome_comercial || null,
        doses_recomendadas: form.doses_recomendadas,
        intervalo_doses: form.intervalo_doses || null,
        via_aplicacao: form.via_aplicacao || null,
        indicacao_ocupacional: form.indicacao_ocupacional || null,
        contraindicacoes: form.contraindicacoes || null,
        origem: form.origem,
        reforco_periodicidade: form.reforco_periodicidade || null,
        codigo_esocial: form.codigo_esocial || null,
        riscos_relacionados: form.riscos_relacionados_text
          .split(",").map((s) => s.trim()).filter(Boolean),
        categorias_profissionais: form.categorias_profissionais_text
          .split(",").map((s) => s.trim()).filter(Boolean),
        observacoes: form.observacoes || null,
        ativo: form.ativo,
      };
      if (editing) {
        const { error } = await supabase.from("vacina_catalog").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vacina_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Vacina atualizada" : "Vacina cadastrada");
      qc.invalidateQueries({ queryKey: ["catalogo-vacinas"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vacina_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vacina removida");
      qc.invalidateQueries({ queryKey: ["catalogo-vacinas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/catalogos" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Hub de Catálogos
      </Link>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Syringe className="h-6 w-6 text-lime-700" />
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Vacinas Ocupacionais</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} className="bg-lime-700 hover:bg-lime-800">
              <Plus className="h-4 w-4 mr-1" /> Nova Vacina
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Vacina" : "Nova Vacina"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Nome Comercial</Label>
                  <Input value={form.nome_comercial ?? ""} onChange={(e) => setForm({ ...form, nome_comercial: e.target.value })} />
                </div>
                <div>
                  <Label>Doses recomendadas</Label>
                  <Input type="number" min={1} value={form.doses_recomendadas} onChange={(e) => setForm({ ...form, doses_recomendadas: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label>Intervalo entre doses</Label>
                  <Input value={form.intervalo_doses ?? ""} onChange={(e) => setForm({ ...form, intervalo_doses: e.target.value })} placeholder="Ex.: 0, 1 e 6 meses" />
                </div>
                <div>
                  <Label>Via de aplicação</Label>
                  <Input value={form.via_aplicacao ?? ""} onChange={(e) => setForm({ ...form, via_aplicacao: e.target.value })} placeholder="Ex.: Intramuscular" />
                </div>
                <div>
                  <Label>Origem</Label>
                  <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v as FormState["origem"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PNI">PNI (SUS)</SelectItem>
                      <SelectItem value="PRIVADA">Rede Privada</SelectItem>
                      <SelectItem value="AMBAS">Ambas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Indicação ocupacional</Label>
                <Textarea rows={2} value={form.indicacao_ocupacional ?? ""} onChange={(e) => setForm({ ...form, indicacao_ocupacional: e.target.value })} />
              </div>
              <div>
                <Label>Contraindicações</Label>
                <Textarea rows={2} value={form.contraindicacoes ?? ""} onChange={(e) => setForm({ ...form, contraindicacoes: e.target.value })} />
              </div>
              <div>
                <Label>Periodicidade de reforço</Label>
                <Input value={form.reforco_periodicidade ?? ""} onChange={(e) => setForm({ ...form, reforco_periodicidade: e.target.value })} placeholder="Ex.: A cada 10 anos" />
              </div>
              <div>
                <Label>Riscos relacionados (separar por vírgula)</Label>
                <Input value={form.riscos_relacionados_text} onChange={(e) => setForm({ ...form, riscos_relacionados_text: e.target.value })} placeholder="Ex.: Risco Biológico, Perfurocortantes" />
              </div>
              <div>
                <Label>Categorias profissionais (separar por vírgula)</Label>
                <Input value={form.categorias_profissionais_text} onChange={(e) => setForm({ ...form, categorias_profissionais_text: e.target.value })} placeholder="Ex.: Enfermagem, Soldadores" />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!form.nome || saveMut.isPending} className="bg-lime-700 hover:bg-lime-800">
                {saveMut.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-slate-600">
        Vacinas ocupacionais conforme NR-07, PCMSO e PNI (Ministério da Saúde). Base para as
        convocações de vacinação e para os cruzamentos com riscos biológicos no PGR.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, indicação, categoria…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["todos", "PNI", "PRIVADA", "AMBAS"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setOrigem(f)}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-md border transition ${
                origem === f ? "bg-lime-700 text-white border-lime-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "todos" ? "Todas" : f === "PNI" ? "PNI (SUS)" : f === "PRIVADA" ? "Privada" : "Ambas"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      {isLoading && <div className="text-center py-8 text-slate-400 text-sm">Carregando…</div>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">Nenhuma vacina encontrada.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((v) => (
          <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-900">{v.nome}</h3>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    v.origem === "PNI" ? "bg-green-50 text-green-700 border-green-200"
                    : v.origem === "PRIVADA" ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>{v.origem}</span>
                  {!v.ativo && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Inativa</span>
                  )}
                </div>
                {v.nome_comercial && <p className="text-xs text-slate-400 italic">{v.nome_comercial}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => confirm(`Remover "${v.nome}" do catálogo?`) && deleteMut.mutate(v.id)}
                  className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
              <p><b className="text-slate-800">Doses:</b> {v.doses_recomendadas}{v.intervalo_doses ? ` (${v.intervalo_doses})` : ""}</p>
              {v.via_aplicacao && <p><b className="text-slate-800">Via:</b> {v.via_aplicacao}</p>}
              {v.reforco_periodicidade && <p><b className="text-slate-800">Reforço:</b> {v.reforco_periodicidade}</p>}
              {v.indicacao_ocupacional && (
                <p className="text-slate-600"><b className="text-slate-800">Indicação:</b> {v.indicacao_ocupacional}</p>
              )}
              {(v.categorias_profissionais ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {v.categorias_profissionais!.map((c) => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{c}</span>
                  ))}
                </div>
              )}
              {(v.riscos_relacionados ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {v.riscos_relacionados!.map((r) => (
                    <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 inline-flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" /> {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope, Plus, Search, MapPin, Phone, Mail, Building2,
  CheckCircle2, Pencil, Trash2, Power,
} from "lucide-react";
import { PrestadorDialog, type Prestador } from "@/components/prestadores/prestador-dialog";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/sesmt/prestadores")({
  component: PrestadoresPage,
  head: () => ({ meta: [{ title: "Prestadores de Saúde · SIGMO" }] }),
});

function PrestadoresPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Prestador | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Prestador | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["prestadores-saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prestadores_saude")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as Prestador[];
    },
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = search.toLowerCase().trim();
    return list.filter((p) => {
      if (!showInactive && !p.ativo) return false;
      if (!q) return true;
      return (
        p.razao_social.toLowerCase().includes(q) ||
        (p.nome_fantasia ?? "").toLowerCase().includes(q) ||
        (p.cnpj ?? "").includes(q) ||
        (p.cidade ?? "").toLowerCase().includes(q) ||
        p.especialidades.some((e) => e.toLowerCase().includes(q))
      );
    });
  }, [data, search, showInactive]);

  const stats = useMemo(() => {
    const all = data ?? [];
    const ativos = all.filter((p) => p.ativo).length;
    const especSet = new Set<string>();
    all.forEach((p) => p.especialidades.forEach((e) => especSet.add(e)));
    const cidades = new Set(all.map((p) => p.cidade).filter(Boolean)).size;
    return { total: all.length, ativos, especialidades: especSet.size, cidades };
  }, [data]);

  const toggleAtivo = useMutation({
    mutationFn: async (p: Prestador) => {
      const { error } = await supabase.from("prestadores_saude").update({ ativo: !p.ativo }).eq("id", p.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestadores-saude"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prestadores_saude").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestadores-saude"] });
      toast.success("Prestador removido");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header glass */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900/50 to-slate-950/80 backdrop-blur-xl p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/30 grid place-items-center shrink-0">
              <Stethoscope className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white/95 truncate">Prestadores de Saúde</h1>
              <p className="text-sm text-slate-400">Clínicas e laboratórios para convocações de ASO e guias de encaminhamento.</p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo prestador
          </Button>
        </div>
      </div>

      {/* KPIs glass com chrome border */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={stats.total} icon={Building2} tone="cyan" />
        <KpiCard label="Ativos" value={stats.ativos} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Especialidades" value={stats.especialidades} icon={Stethoscope} tone="violet" />
        <KpiCard label="Cidades" value={stats.cidades} icon={MapPin} tone="amber" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ, cidade ou especialidade…"
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
          {(data?.length ?? 0) === 0
            ? "Nenhum prestador cadastrado. Clique em \"Novo prestador\" para começar."
            : "Nenhum resultado para os filtros aplicados."}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded-xl border bg-white/5 backdrop-blur-xl p-4 transition hover:bg-white/[0.07] ${
                p.ativo ? "border-white/10 hover:border-cyan-400/30" : "border-white/5 opacity-60"
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white/95 truncate">{p.nome_fantasia || p.razao_social}</h3>
                    {!p.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                  </div>
                  {p.nome_fantasia && (
                    <p className="text-xs text-slate-500 truncate">{p.razao_social}</p>
                  )}
                  {p.cnpj && <p className="text-xs text-slate-400 mt-0.5">CNPJ {p.cnpj}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleAtivo.mutate(p)} title={p.ativo ? "Desativar" : "Ativar"}>
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-red-400" onClick={() => setToDelete(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-300">
                {(p.logradouro || p.cidade) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-500 shrink-0" />
                    <span className="text-xs">
                      {[p.logradouro, p.numero].filter(Boolean).join(", ")}
                      {p.bairro ? ` — ${p.bairro}` : ""}
                      {p.cidade ? ` · ${p.cidade}${p.uf ? `/${p.uf}` : ""}` : ""}
                    </span>
                  </div>
                )}
                {p.telefone && <div className="flex items-center gap-2 text-xs"><Phone className="h-3.5 w-3.5 text-slate-500" /> {p.telefone}</div>}
                {p.email && <div className="flex items-center gap-2 text-xs"><Mail className="h-3.5 w-3.5 text-slate-500" /> {p.email}</div>}
              </div>

              {p.especialidades.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.especialidades.slice(0, 6).map((e) => (
                    <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-400/20">{e}</span>
                  ))}
                  {p.especialidades.length > 6 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">+{p.especialidades.length - 6}</span>
                  )}
                </div>
              )}

              {p.tipos_guia_esocial.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tipos_guia_esocial.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <PrestadorDialog open={open} onOpenChange={setOpen} prestador={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(b) => !b && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover prestador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente <strong>{toDelete?.nome_fantasia || toDelete?.razao_social}</strong>.
              Se preferir, desative o prestador em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete?.id && remove.mutate(toDelete.id)} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const TONES: Record<string, { ring: string; bg: string; text: string }> = {
  cyan: { ring: "ring-cyan-400/30", bg: "bg-cyan-500/15", text: "text-cyan-300" },
  emerald: { ring: "ring-emerald-400/30", bg: "bg-emerald-500/15", text: "text-emerald-300" },
  violet: { ring: "ring-violet-400/30", bg: "bg-violet-500/15", text: "text-violet-300" },
  amber: { ring: "ring-amber-400/30", bg: "bg-amber-500/15", text: "text-amber-300" },
};

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white/95 mt-0.5">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-lg ${t.bg} ring-1 ${t.ring} grid place-items-center`}>
          <Icon className={`h-5 w-5 ${t.text}`} />
        </div>
      </div>
    </div>
  );
}
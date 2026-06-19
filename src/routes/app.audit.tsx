import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Download, Search, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/audit")({
  component: AuditPage,
});

const TABLES = [
  { value: "all", label: "Todas as tabelas" },
  { value: "employees", label: "Colaboradores" },
  { value: "companies", label: "Empresas" },
  { value: "employee_exams", label: "Exames" },
  { value: "employee_docs", label: "Documentos" },
  { value: "epi_deliveries", label: "EPIs" },
  { value: "ptes", label: "PTEs" },
  { value: "roles", label: "Cargos" },
  { value: "user_roles", label: "Papéis de usuário" },
];

const ACTIONS = [
  { value: "all", label: "Todas as ações" },
  { value: "INSERT", label: "Criação" },
  { value: "UPDATE", label: "Alteração" },
  { value: "DELETE", label: "Exclusão" },
];

const ACTION_STYLES: Record<string, string> = {
  INSERT: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30 shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]",
  UPDATE: "bg-amber-500/20 text-amber-300 border-amber-400/30 shadow-[0_0_12px_-2px_rgba(245,158,11,0.5)]",
  DELETE: "bg-rose-500/20 text-rose-300 border-rose-400/30 shadow-[0_0_12px_-2px_rgba(244,63,94,0.5)]",
};

function AuditPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/app" });
  }, [loading, isAdmin, navigate]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit_logs", tableFilter, actionFilter, from, to],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter((l: any) => {
      const blob = JSON.stringify({
        e: l.user_email,
        n: l.new_data,
        o: l.old_data,
        r: l.record_id,
      }).toLowerCase();
      return blob.includes(s);
    });
  }, [logs, search]);

  function exportCsv() {
    const header = ["Data/Hora", "Usuário", "Tabela", "Ação", "Registro ID", "Dados Anteriores", "Dados Novos"];
    const rows = filtered.map((l: any) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.user_email ?? "",
      l.table_name,
      l.action,
      l.record_id ?? "",
      JSON.stringify(l.old_data ?? {}),
      JSON.stringify(l.new_data ?? {}),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function diffKeys(oldD: any, newD: any) {
    if (!oldD || !newD) return [];
    const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
    const out: { key: string; old: any; new: any }[] = [];
    keys.forEach((k) => {
      if (k === "updated_at") return;
      if (JSON.stringify(oldD[k]) !== JSON.stringify(newD[k])) {
        out.push({ key: k, old: oldD[k], new: newD[k] });
      }
    });
    return out;
  }

  if (!isAdmin) return null;

  return (
    <div className="relative p-6 md:p-8 animate-fadeIn h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-[#1a0309] via-[#2a0612] to-[#1a0309]">
      {/* Glow ambient */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#c8102e]/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full bg-[#5c0a1c]/40 blur-[120px]" />

      <div className="relative flex items-center justify-between mb-6">
        <h2 className="heading-display text-3xl md:text-4xl text-white flex items-center gap-3 drop-shadow-[0_2px_12px_rgba(200,16,46,0.6)]">
          <ShieldCheck className="h-8 w-8 text-[#ff4d6d]" /> Log de Auditoria
        </h2>
        <Button
          onClick={exportCsv}
          className="gap-2 bg-gradient-to-r from-[#c8102e] via-[#a00d24] to-[#7a0a1c] hover:from-[#d81a3a] hover:to-[#8a0b1f] text-white border border-white/10 shadow-[0_10px_30px_-10px_rgba(200,16,46,0.7)] backdrop-blur-md"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl p-6 shadow-[0_20px_60px_-20px_rgba(200,16,46,0.45)] border border-white/10 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Tabela</Label>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white hover:bg-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TABLES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Ação</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white hover:bg-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black text-white/60 uppercase tracking-widest">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-2 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-2 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Buscar</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="E-mail, nome, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_-20px_rgba(200,16,46,0.45)] border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#c8102e]/15 via-transparent to-transparent">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            {logs.length === 500 && <span className="ml-2 text-[10px] text-amber-300">(limite de 500 — refine os filtros)</span>}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-white/50">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-white/50">Nenhum registro encontrado.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((l: any) => {
              const isOpen = expanded === l.id;
              const diffs = l.action === "UPDATE" ? diffKeys(l.old_data, l.new_data) : [];
              return (
                <div key={l.id} className="hover:bg-white/5 transition-colors">
                  <button
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                    className="w-full px-6 py-4 flex items-center gap-4 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-white/50" /> : <ChevronRight className="h-4 w-4 text-white/50" />}
                    <div className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${ACTION_STYLES[l.action]}`}>
                      {l.action === "INSERT" ? "CRIOU" : l.action === "UPDATE" ? "ALTEROU" : "EXCLUIU"}
                    </div>
                    <div className="text-xs font-bold text-white/90 min-w-[140px]">{l.table_name}</div>
                    <div className="flex-1 text-xs text-white/70 truncate">
                      {l.user_email ?? <span className="italic text-white/40">sistema</span>}
                    </div>
                    <div className="text-[10px] text-white/50 font-mono">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-2 bg-black/20 border-t border-white/5">
                      <div className="text-[10px] font-black uppercase text-white/60 mb-2">
                        Registro ID: <span className="font-mono">{l.record_id ?? "—"}</span>
                      </div>

                      {l.action === "UPDATE" && diffs.length > 0 && (
                        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4 mb-3">
                          <div className="text-[10px] font-black uppercase text-white/60 mb-3">Campos alterados</div>
                          <div className="space-y-2">
                            {diffs.map((d) => (
                              <div key={d.key} className="grid grid-cols-12 gap-2 text-xs">
                                <div className="col-span-3 font-bold text-white/90">{d.key}</div>
                                <div className="col-span-4 text-rose-300 line-through truncate">
                                  {d.old === null || d.old === undefined ? "—" : typeof d.old === "object" ? JSON.stringify(d.old) : String(d.old)}
                                </div>
                                <div className="col-span-1 text-center text-white/40">→</div>
                                <div className="col-span-4 text-emerald-300 font-semibold truncate">
                                  {d.new === null || d.new === undefined ? "—" : typeof d.new === "object" ? JSON.stringify(d.new) : String(d.new)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {l.old_data && (
                          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4">
                            <div className="text-[10px] font-black uppercase text-white/60 mb-2">Dados anteriores</div>
                            <pre className="text-[10px] text-white/70 overflow-x-auto max-h-60 font-mono">
                              {JSON.stringify(l.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {l.new_data && (
                          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4">
                            <div className="text-[10px] font-black uppercase text-white/60 mb-2">Dados novos</div>
                            <pre className="text-[10px] text-white/70 overflow-x-auto max-h-60 font-mono">
                              {JSON.stringify(l.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

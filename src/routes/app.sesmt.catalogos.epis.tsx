import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HardHat, ChevronLeft, Search, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/app/sesmt/catalogos/epis")({
  component: EpisPage,
  head: () => ({
    meta: [
      { title: "Catálogo de EPIs (CA) — SIGMO" },
      { name: "description", content: "Equipamentos de Proteção Individual com Certificado de Aprovação, validades e estoque." },
    ],
  }),
});

type EpiRow = {
  id: string;
  codigo_material: string | null;
  nome_material: string;
  ca: string | null;
  ca_validade: string | null;
  quantidade_atual: number | null;
  estoque_minimo: number | null;
  imagem_url: string | null;
  ultimo_fornecedor: string | null;
};

function statusCA(validade: string | null): { label: string; cls: string; Icon: typeof CheckCircle2 } {
  if (!validade) return { label: "Sem CA", cls: "bg-slate-100 text-slate-600 border-slate-200", Icon: XCircle };
  const hoje = new Date();
  const dt = new Date(validade);
  const diffDias = Math.floor((dt.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return { label: "Vencido", cls: "bg-rose-100 text-rose-700 border-rose-200", Icon: XCircle };
  if (diffDias <= 90) return { label: `Vence em ${diffDias}d`, cls: "bg-amber-100 text-amber-700 border-amber-200", Icon: AlertTriangle };
  return { label: "Vigente", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CheckCircle2 };
}

function EpisPage() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "vigente" | "vencido" | "sem_ca">("todos");

  const { data = [], isLoading } = useQuery({
    queryKey: ["catalogo-epis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, codigo_material, nome_material, ca, ca_validade, quantidade_atual, estoque_minimo, imagem_url, ultimo_fornecedor")
        .order("nome_material");
      if (error) throw error;
      return data as EpiRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return data.filter((e) => {
      const st = statusCA(e.ca_validade).label;
      if (filtro === "vigente" && st !== "Vigente" && !st.startsWith("Vence")) return false;
      if (filtro === "vencido" && st !== "Vencido") return false;
      if (filtro === "sem_ca" && st !== "Sem CA") return false;
      if (!s) return true;
      return (
        e.nome_material.toLowerCase().includes(s) ||
        (e.ca ?? "").toLowerCase().includes(s) ||
        (e.codigo_material ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, q, filtro]);

  const stats = useMemo(() => {
    let vig = 0, venc = 0, sem = 0, prox = 0;
    for (const e of data) {
      const st = statusCA(e.ca_validade).label;
      if (st === "Vigente") vig++;
      else if (st === "Vencido") venc++;
      else if (st === "Sem CA") sem++;
      else prox++;
    }
    return { vig, venc, sem, prox };
  }, [data]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/catalogos" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Hub de Catálogos
      </Link>
      <div className="flex items-center gap-2">
        <HardHat className="h-6 w-6 text-amber-600" />
        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Catálogo de EPIs — Certificado de Aprovação</h1>
      </div>
      <p className="text-xs text-slate-600">
        Base de EPIs cadastrados no estoque. Cada EPI deve ter CA (Certificado de Aprovação) válido conforme NR-06.
        Alimenta a Ficha de EPI, o PGR (medidas de controle) e as requisições de compra.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Vigentes" value={stats.vig} cls="border-emerald-200 bg-emerald-50 text-emerald-800" />
        <StatCard label="Próximos vencimento" value={stats.prox} cls="border-amber-200 bg-amber-50 text-amber-800" />
        <StatCard label="Vencidos" value={stats.venc} cls="border-rose-200 bg-rose-50 text-rose-800" />
        <StatCard label="Sem CA cadastrado" value={stats.sem} cls="border-slate-200 bg-slate-50 text-slate-700" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CA ou código…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["todos", "vigente", "vencido", "sem_ca"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-md border transition ${
                filtro === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "todos" ? "Todos" : f === "vigente" ? "Vigentes" : f === "vencido" ? "Vencidos" : "Sem CA"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600">EPI</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 w-28">CA</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 w-36">Validade CA</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 w-32">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400 text-xs">Carregando…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400 text-xs">Nenhum EPI encontrado.</td></tr>
              )}
              {filtered.map((e) => {
                const st = statusCA(e.ca_validade);
                const StIcon = st.Icon;
                const baixo = (e.quantidade_atual ?? 0) <= (e.estoque_minimo ?? 0);
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {e.imagem_url ? (
                          <img src={e.imagem_url} alt="" className="h-8 w-8 rounded object-cover border border-slate-200" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-slate-100 grid place-items-center">
                            <HardHat className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{e.nome_material}</p>
                          {e.codigo_material && (
                            <p className="text-[10px] font-mono text-slate-400">{e.codigo_material}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-700">{e.ca ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${st.cls}`}>
                        <StIcon className="h-3 w-3" /> {st.label}
                      </span>
                      {e.ca_validade && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(e.ca_validade).toLocaleDateString("pt-BR")}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-bold ${baixo ? "text-rose-600" : "text-slate-700"}`}>
                        {e.quantidade_atual ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-400"> / mín {e.estoque_minimo ?? 0}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        <b>Dica:</b> para cadastrar novos EPIs ou movimentar estoque, use o módulo
        {" "}<Link to="/app/estoque/epi" className="text-amber-700 font-bold underline">Estoque de EPIs</Link>.
        Este catálogo é a visão consolidada dos CAs para consulta rápida.
      </p>
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, ChevronLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/app/sesmt/catalogos/exames")({
  component: ExamesPage,
});

function ExamesPage() {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["catalogo-exames"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_catalog").select("*").eq("ativo", true).order("procedimento");
      if (error) throw error;
      return data;
    },
  });
  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return data;
    return data.filter((e: { codigo: string | null; procedimento: string }) =>
      e.procedimento.toLowerCase().includes(s) || (e.codigo ?? "").toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app/sesmt/catalogos" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Hub de Catálogos
      </Link>
      <div className="flex items-center gap-2">
        <Stethoscope className="h-6 w-6 text-sky-700" />
        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Catálogo de Exames — Tabela 27 eSocial</h1>
      </div>
      <p className="text-xs text-slate-600">
        Procedimentos médicos usados no PCMSO. O código eSocial é enviado no evento S-2220.
      </p>
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou procedimento…" className="pl-9" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 w-32">Código</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600">Procedimento</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400 text-xs">Carregando…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400 text-xs">Nenhum exame encontrado.</td></tr>}
            {filtered.map((e: { id: string; codigo: string | null; procedimento: string }) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-xs font-bold text-sky-700">{e.codigo ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-800">{e.procedimento}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

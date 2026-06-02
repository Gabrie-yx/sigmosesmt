import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClipboardList, Users, Clock, Building2, ShieldAlert } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

type Ghe = {
  id: string;
  numero: number;
  setor: string;
  descricao_ambiente: string | null;
  qtd_colaboradores: number | null;
  jornada: string | null;
};

const CAT_STYLE: Record<string, { label: string; bg: string; border: string; chip: string }> = {
  FISICO:     { label: "Físico",     bg: "bg-emerald-50",  border: "border-emerald-300", chip: "bg-emerald-600 text-white" },
  QUIMICO:    { label: "Químico",    bg: "bg-rose-50",     border: "border-rose-300",    chip: "bg-rose-600 text-white" },
  BIOLOGICO:  { label: "Biológico",  bg: "bg-amber-50",    border: "border-amber-300",   chip: "bg-amber-600 text-white" },
  ERGONOMICO: { label: "Ergonômico", bg: "bg-sky-50",      border: "border-sky-300",     chip: "bg-sky-600 text-white" },
  ACIDENTE:   { label: "Acidente",   bg: "bg-violet-50",   border: "border-violet-300",  chip: "bg-violet-600 text-white" },
  MECANICO:   { label: "Mecânico",   bg: "bg-violet-50",   border: "border-violet-300",  chip: "bg-violet-600 text-white" },
};

export function GheFichaDialog({
  open, onOpenChange, ghe,
}: { open: boolean; onOpenChange: (v: boolean) => void; ghe: Ghe | null }) {
  const gheId = ghe?.id;

  // Cargos vinculados a este GHE
  const { data: cargos = [] } = useQuery({
    queryKey: ["ghe_ficha_cargos", gheId],
    enabled: open && !!gheId,
    queryFn: async () => {
      const { data } = await sb
        .from("roles")
        .select("id, name, cbo, setor, descricao_atividades")
        .eq("ghe_id", gheId)
        .eq("ativo", true)
        .order("name");
      return data ?? [];
    },
  });

  // Quantidade efetiva de membros
  const { data: qtdMembros = 0 } = useQuery({
    queryKey: ["ghe_ficha_qtd", gheId],
    enabled: open && !!gheId,
    queryFn: async () => {
      const { data } = await sb.from("pgr_ghe_membros_efetivos").select("employee_id").eq("ghe_id", gheId);
      return (data ?? []).length;
    },
  });

  // Matriz de riscos: cargo_riscos dos cargos do GHE + catalogo_riscos
  const { data: matriz = [], isLoading: loadingMatriz } = useQuery({
    queryKey: ["ghe_ficha_matriz", gheId, cargos.map((c: any) => c.id).join(",")],
    enabled: open && !!gheId && cargos.length > 0,
    queryFn: async () => {
      const roleIds = cargos.map((c: any) => c.id);
      const { data: cr } = await sb
        .from("cargo_riscos")
        .select("id, role_id, risco_id, intensidade, unidade, limite_tolerancia, fonte_geradora, meios_controle, tempo_exposicao_min, tecnica_medicao, status_avaliacao, proxima_avaliacao")
        .in("role_id", roleIds)
        .eq("ativo", true);
      const riscoIds = Array.from(new Set((cr ?? []).map((r: any) => r.risco_id))).filter(Boolean);
      if (riscoIds.length === 0) return [];
      const { data: cat } = await sb
        .from("catalogo_riscos")
        .select("id, nome, categoria, efeitos_tipicos, medidas_controle_padrao")
        .in("id", riscoIds);
      const catMap = new Map<string, any>((cat ?? []).map((c: any) => [c.id, c]));
      const cargoMap = new Map<string, string>(cargos.map((c: any) => [c.id, c.name]));
      return (cr ?? []).map((r: any) => {
        const c = catMap.get(r.risco_id);
        return {
          ...r,
          cargo_nome: cargoMap.get(r.role_id) ?? "—",
          perigo: c?.nome ?? "—",
          categoria: c?.categoria ?? "ACIDENTE",
          agravos: (c?.efeitos_tipicos ?? []).join(", "),
          controles_padrao: (c?.medidas_controle_padrao ?? []).join(", "),
        };
      });
    },
  });

  // Agrupar matriz por categoria
  const matrizPorCat = new Map<string, any[]>();
  for (const row of matriz as any[]) {
    const arr = matrizPorCat.get(row.categoria) ?? [];
    arr.push(row);
    matrizPorCat.set(row.categoria, arr);
  }

  if (!ghe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gradient-to-r from-rose-50 via-white to-amber-50">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-rose-700" />
            Ficha do GHE {ghe.numero} — {ghe.setor}
          </DialogTitle>
          <p className="text-xs text-slate-500">Visão consolidada para o PGR — cabeçalho, cargos e matriz de riscos.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* CABEÇALHO */}
          <Card className="p-4 border-rose-200">
            <div className="flex items-start gap-3 mb-3">
              <Badge className="bg-rose-700 text-white text-base px-3 py-1">GHE {ghe.numero}</Badge>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 text-lg">{ghe.setor}</h3>
                {ghe.descricao_ambiente && <p className="text-sm text-slate-600 mt-0.5">{ghe.descricao_ambiente}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Info icon={<Users className="h-4 w-4" />} label="Colaboradores ativos" value={String(qtdMembros)} />
              <Info icon={<Clock className="h-4 w-4" />} label="Jornada" value={ghe.jornada ?? "—"} />
              <Info icon={<Building2 className="h-4 w-4" />} label="Cargos no GHE" value={String(cargos.length)} />
            </div>
          </Card>

          {/* TABELA CARGOS */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              Setor / Cargo / CBO / Descrição das atividades
            </h4>
            {cargos.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-500">
                Nenhum cargo vinculado a este GHE. Use a tela "Vincular cargos aos GHEs" para configurar.
              </Card>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Setor</th>
                      <th className="px-3 py-2 text-left">Cargo</th>
                      <th className="px-3 py-2 text-left">CBO</th>
                      <th className="px-3 py-2 text-left">Descrição das atividades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargos.map((c: any, i: number) => (
                      <tr key={c.id} className={i % 2 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="px-3 py-2 align-top">{c.setor ?? ghe.setor}</td>
                        <td className="px-3 py-2 font-semibold align-top">{c.name}</td>
                        <td className="px-3 py-2 align-top text-slate-600">{c.cbo ?? "—"}</td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {c.descricao_atividades ?? <span className="italic text-slate-400">— sem descrição cadastrada —</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* MATRIZ DE RISCOS */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5" /> Matriz de riscos do GHE
            </h4>
            {loadingMatriz ? (
              <p className="text-sm text-slate-500 py-4">Carregando matriz…</p>
            ) : matriz.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-500">
                Nenhum risco mapeado para os cargos deste GHE. Cadastre em "Matriz de Riscos".
              </Card>
            ) : (
              <div className="space-y-4">
                {Array.from(matrizPorCat.entries()).map(([cat, rows]) => {
                  const st = CAT_STYLE[cat] ?? CAT_STYLE.ACIDENTE;
                  return (
                    <div key={cat} className={`border ${st.border} rounded-lg overflow-hidden`}>
                      <div className={`px-3 py-2 ${st.chip} text-xs font-black uppercase tracking-widest`}>
                        {st.label} · {rows.length} risco{rows.length === 1 ? "" : "s"}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className={`${st.bg} text-slate-700`}>
                            <tr>
                              <th className="px-2 py-2 text-left">Cargo</th>
                              <th className="px-2 py-2 text-left">Perigo</th>
                              <th className="px-2 py-2 text-left">Agravos</th>
                              <th className="px-2 py-2 text-left">Fontes</th>
                              <th className="px-2 py-2 text-left">Controles</th>
                              <th className="px-2 py-2 text-left">Exposição</th>
                              <th className="px-2 py-2 text-left">Intensidade</th>
                              <th className="px-2 py-2 text-left">LT</th>
                              <th className="px-2 py-2 text-left">Avaliação</th>
                              <th className="px-2 py-2 text-left">Monitoramento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r: any, i: number) => (
                              <tr key={r.id} className={i % 2 ? "bg-white" : `${st.bg}/40`}>
                                <td className="px-2 py-2 align-top whitespace-nowrap">{r.cargo_nome}</td>
                                <td className="px-2 py-2 align-top font-semibold">{r.perigo}</td>
                                <td className="px-2 py-2 align-top text-slate-600">{r.agravos || "—"}</td>
                                <td className="px-2 py-2 align-top text-slate-600">{r.fonte_geradora ?? "—"}</td>
                                <td className="px-2 py-2 align-top text-slate-600">{r.meios_controle ?? r.controles_padrao ?? "—"}</td>
                                <td className="px-2 py-2 align-top">{r.tempo_exposicao_min != null ? `${r.tempo_exposicao_min} min` : "—"}</td>
                                <td className="px-2 py-2 align-top">{r.intensidade != null ? `${r.intensidade} ${r.unidade ?? ""}`.trim() : "—"}</td>
                                <td className="px-2 py-2 align-top">{r.limite_tolerancia != null ? `${r.limite_tolerancia} ${r.unidade ?? ""}`.trim() : "—"}</td>
                                <td className="px-2 py-2 align-top">{r.tecnica_medicao ?? r.status_avaliacao ?? "—"}</td>
                                <td className="px-2 py-2 align-top">{r.proxima_avaliacao ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-100">
      <div className="text-slate-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
        <p className="font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}
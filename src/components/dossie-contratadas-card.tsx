import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, FileWarning, FileQuestion, ChevronRight } from "lucide-react";

type Row = {
  company_id: string;
  empresa: string;
  tipo_empresa: string;
  docs_vigentes: number;
  docs_vencidos: number;
  acordos_ativos: number;
  acordos_vencidos: number;
  status_geral: "REGULAR" | "EM_ADEQUACAO" | "IRREGULAR" | "SEM_DOCS";
};

const META: Record<Row["status_geral"], { label: string; cls: string; Icon: any; rank: number }> = {
  IRREGULAR:    { label: "Irregular",      cls: "bg-rose-600/30 text-rose-50 ring-rose-300/50",     Icon: AlertTriangle, rank: 0 },
  EM_ADEQUACAO: { label: "Em acordo",      cls: "bg-amber-500/25 text-amber-100 ring-amber-300/40", Icon: FileWarning,   rank: 1 },
  SEM_DOCS:     { label: "Sem dossiê",     cls: "bg-slate-600/40 text-slate-100 ring-slate-300/40", Icon: FileQuestion,  rank: 2 },
  REGULAR:      { label: "Regular",        cls: "bg-emerald-500/25 text-emerald-100 ring-emerald-300/40", Icon: Shield,  rank: 3 },
};

export function DossieContratadasCard() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["hoje-dossie-contratadas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_contratada_dossie_status" as any)
        .select("*");
      return ((data ?? []) as unknown) as Row[];
    },
  });

  const contratadas = rows.filter((r) => !(r.empresa ?? "").toUpperCase().includes("DMN"));
  const atencao = contratadas
    .filter((r) => r.status_geral !== "REGULAR")
    .sort((a, b) => META[a.status_geral].rank - META[b.status_geral].rank || a.empresa.localeCompare(b.empresa));

  const counts = {
    irregular: contratadas.filter((r) => r.status_geral === "IRREGULAR").length,
    acordo:    contratadas.filter((r) => r.status_geral === "EM_ADEQUACAO").length,
    sem:       contratadas.filter((r) => r.status_geral === "SEM_DOCS").length,
    regular:   contratadas.filter((r) => r.status_geral === "REGULAR").length,
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-14 pb-6">
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-100">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[rgba(245,225,225,0.55)]">
                NR-01 · Dossiê das Contratadas
              </div>
              <h3 className="text-base font-black text-[rgba(255,240,242,0.96)] leading-tight">
                Empresas que precisam de atenção
              </h3>
            </div>
          </div>
          <Link
            to="/app/companies"
            className="text-[10px] font-black uppercase tracking-widest text-rose-200 hover:text-white inline-flex items-center gap-1"
          >
            Abrir empresas <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <KPI label="Irregular" value={counts.irregular} cls="text-rose-200 border-rose-400/30 bg-rose-500/10" />
          <KPI label="Em acordo" value={counts.acordo} cls="text-amber-200 border-amber-400/30 bg-amber-500/10" />
          <KPI label="Sem dossiê" value={counts.sem} cls="text-slate-200 border-slate-400/30 bg-slate-500/10" />
          <KPI label="Regular" value={counts.regular} cls="text-emerald-200 border-emerald-400/30 bg-emerald-500/10" />
        </div>

        {isLoading ? (
          <div className="text-xs text-[rgba(245,225,225,0.6)]">Carregando…</div>
        ) : atencao.length === 0 ? (
          <div className="text-xs text-emerald-200/90 font-bold">
            Todas as contratadas estão regulares. Dia começou em ordem. 🎉
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {atencao.slice(0, 8).map((r) => {
              const m = META[r.status_geral];
              const I = m.Icon;
              return (
                <li key={r.company_id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <I className="h-4 w-4 text-rose-200/80 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[rgba(255,240,242,0.96)] truncate">{r.empresa}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[rgba(245,225,225,0.55)] truncate">
                        {r.docs_vencidos > 0 && `${r.docs_vencidos} doc(s) vencido(s) · `}
                        {r.acordos_ativos > 0 && `${r.acordos_ativos} acordo(s) ativo(s) · `}
                        {r.docs_vigentes > 0 && `${r.docs_vigentes} vigente(s)`}
                        {r.docs_vencidos === 0 && r.acordos_ativos === 0 && r.docs_vigentes === 0 && "Sem documentos cadastrados"}
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded ring-1 ${m.cls}`}>
                    {m.label}
                  </span>
                </li>
              );
            })}
            {atencao.length > 8 && (
              <li className="pt-2 text-[10px] font-black uppercase tracking-widest text-[rgba(245,225,225,0.55)]">
                +{atencao.length - 8} outras
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <div className="text-2xl font-black tabular-nums leading-none">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-80">{label}</div>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import {
  Sparkles, ChevronLeft, Search, ShieldAlert, BookOpenCheck, Stethoscope,
  Syringe, HardHat, Zap, Info, ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/sesmt/catalogos/cruzamentos")({
  component: CruzamentosPage,
  head: () => ({
    meta: [
      { title: "Cruzamentos Inteligentes — Catálogos SIGMO" },
      { name: "description", content: "Infográfico interativo: escolha um risco e veja seus exames, NRs, EPIs e vacinas vinculados." },
    ],
  }),
});

type Risco = {
  id: string;
  categoria: string;
  nome: string;
  efeitos_tipicos: string[] | null;
  medidas_controle_padrao: string[] | null;
  nrs_aplicaveis: string[] | null;
  epis_sugeridos: string[] | null;
  codigo_esocial: string | null;
  aposentadoria_especial_anos: number | null;
};

const CATEGORIA_META: Record<string, { label: string; color: string; ring: string; text: string }> = {
  FISICO: { label: "Físico", color: "from-sky-500 to-blue-700", ring: "ring-sky-400/50", text: "text-sky-200" },
  QUIMICO: { label: "Químico", color: "from-amber-500 to-orange-700", ring: "ring-amber-400/50", text: "text-amber-200" },
  BIOLOGICO: { label: "Biológico", color: "from-emerald-500 to-green-700", ring: "ring-emerald-400/50", text: "text-emerald-200" },
  ERGONOMICO: { label: "Ergonômico", color: "from-purple-500 to-fuchsia-700", ring: "ring-purple-400/50", text: "text-purple-200" },
  ACIDENTE_MECANICO: { label: "Acidente", color: "from-rose-500 to-red-700", ring: "ring-rose-400/50", text: "text-rose-200" },
};

function CruzamentosPage() {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["cruzamentos-riscos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalogo_riscos")
        .select("id,categoria,nome,efeitos_tipicos,medidas_controle_padrao,nrs_aplicaveis,epis_sugeridos,codigo_esocial,aposentadoria_especial_anos")
        .eq("ativo", true).order("nome");
      if (error) throw error;
      return data as Risco[];
    },
  });

  const selected = useMemo(() => riscos.find((r) => r.id === selectedId) ?? null, [riscos, selectedId]);

  const { data: examesRisco = [] } = useQuery({
    queryKey: ["cruzamentos-exames", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase.from("risco_exames")
        .select("id, obrigatorio, naturezas, periodicidade_meses, base_legal, exam_catalog:exam_id(codigo,procedimento)")
        .eq("risco_id", selectedId!).eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return riscos;
    return riscos.filter((r) => r.nome.toLowerCase().includes(s) || r.categoria.toLowerCase().includes(s));
  }, [riscos, q]);

  const grouped = useMemo(() => {
    const g: Record<string, Risco[]> = {};
    for (const r of filtered) (g[r.categoria] ??= []).push(r);
    return g;
  }, [filtered]);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* HERO */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(217,70,239,0.25),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(99,102,241,0.25),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-6">
          <Link to="/app/sesmt/catalogos" className="text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" /> Hub de Catálogos
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-700 shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">
                Cruzamentos Inteligentes
              </h1>
              <p className="text-xs text-white/60">
                Clique num risco → veja em tempo real os exames, NRs, EPIs e vacinas vinculados.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* SIDEBAR de riscos */}
        <aside className="space-y-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar risco…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {isLoading && <div className="text-xs text-white/50">Carregando…</div>}
            {Object.entries(grouped).map(([cat, lista]) => {
              const meta = CATEGORIA_META[cat] ?? CATEGORIA_META.FISICO;
              return (
                <div key={cat}>
                  <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${meta.text}`}>
                    {meta.label} · {lista.length}
                  </div>
                  <div className="space-y-1">
                    {lista.map((r) => {
                      const active = r.id === selectedId;
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                            active
                              ? `bg-gradient-to-r ${meta.color} text-white shadow-lg ring-2 ${meta.ring}`
                              : "bg-white/5 text-white/80 hover:bg-white/10 border border-white/5"
                          }`}
                        >
                          {r.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* INFOGRÁFICO */}
        <main>
          {!selected && <EmptyState />}
          {selected && <Infografico risco={selected} exames={examesRisco} />}
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
      <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-fuchsia-600/20 to-indigo-700/20 border border-white/10">
        <Sparkles className="h-10 w-10 text-fuchsia-300" />
      </div>
      <h2 className="mt-4 text-lg font-black text-white">Escolha um risco à esquerda</h2>
      <p className="mt-1 text-xs text-white/50 max-w-md mx-auto">
        O infográfico vai desenhar automaticamente todos os pontos de conexão desse risco no SIGMO —
        exames obrigatórios, NRs aplicáveis, EPIs sugeridos e vacinas quando pertinente.
      </p>
    </div>
  );
}

type ExameLinha = {
  id: string;
  obrigatorio: boolean;
  naturezas: string[] | null;
  periodicidade_meses: number | null;
  base_legal: string | null;
  exam_catalog: { codigo: string | null; procedimento: string } | null;
};

function Infografico({ risco, exames }: { risco: Risco; exames: ExameLinha[] }) {
  const meta = CATEGORIA_META[risco.categoria] ?? CATEGORIA_META.FISICO;
  const nrs = risco.nrs_aplicaveis ?? [];
  const epis = risco.epis_sugeridos ?? [];
  const efeitos = risco.efeitos_tipicos ?? [];
  const medidas = risco.medidas_controle_padrao ?? [];
  const isBio = risco.categoria === "BIOLOGICO";
  const vacinasSugeridas = isBio
    ? ["Hepatite B (3 doses)", "Tétano (dT ou dTpa)", "Febre Amarela"]
    : [];

  return (
    <div key={risco.id} className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
      {/* CARD DO RISCO */}
      <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${meta.color} p-6 shadow-2xl`}>
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
              Risco {meta.label}
            </div>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-white">{risco.nome}</h2>
            {risco.codigo_esocial && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 text-[10px] font-black text-white/90">
                eSocial · {risco.codigo_esocial}
              </div>
            )}
          </div>
          {risco.aposentadoria_especial_anos && (
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-wider text-white/70">Aposentadoria Especial</div>
              <div className="text-2xl font-black text-white">{risco.aposentadoria_especial_anos} anos</div>
            </div>
          )}
        </div>
        {efeitos.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-1.5">
            {efeitos.map((e) => (
              <span key={e} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/25 text-white/90">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CONECTOR VISUAL */}
      <div className="flex items-center justify-center gap-2 text-white/40">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <Zap className="h-4 w-4 text-fuchsia-400 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest">Cruzamentos ativos</span>
        <Zap className="h-4 w-4 text-fuchsia-400 animate-pulse" />
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* GRID DE CONEXÕES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConexaoCard
          Icon={Stethoscope}
          titulo="Exames Obrigatórios"
          gradient="from-sky-600 to-blue-800"
          count={exames.length}
          empty="Nenhum exame vinculado no catálogo `risco_exames`. Cadastre em Cargos → Riscos → Exames."
        >
          {exames.map((ex) => (
            <div key={ex.id} className="flex items-start justify-between gap-2 py-2 border-b border-white/5 last:border-0">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{ex.exam_catalog?.procedimento ?? "—"}</div>
                <div className="text-[10px] text-white/50 flex flex-wrap gap-2 mt-0.5">
                  {ex.exam_catalog?.codigo && <span className="font-mono">eSocial {ex.exam_catalog.codigo}</span>}
                  {ex.periodicidade_meses && <span>· {ex.periodicidade_meses}m</span>}
                  {ex.base_legal && <span>· {ex.base_legal}</span>}
                </div>
              </div>
              {ex.obrigatorio && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200">
                  OBRIG.
                </span>
              )}
            </div>
          ))}
        </ConexaoCard>

        <ConexaoCard
          Icon={BookOpenCheck}
          titulo="NRs Aplicáveis"
          gradient="from-emerald-600 to-teal-800"
          count={nrs.length}
          empty="Nenhuma NR marcada no catálogo deste risco."
        >
          <div className="flex flex-wrap gap-1.5">
            {nrs.map((nr) => (
              <span key={nr} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-xs font-black text-emerald-100">
                {nr}
              </span>
            ))}
          </div>
        </ConexaoCard>

        <ConexaoCard
          Icon={HardHat}
          titulo="EPIs Sugeridos"
          gradient="from-amber-600 to-orange-800"
          count={epis.length}
          empty="Nenhum EPI sugerido no catálogo deste risco."
        >
          <div className="flex flex-wrap gap-1.5">
            {epis.map((epi) => (
              <span key={epi} className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-xs font-bold text-amber-100">
                {epi}
              </span>
            ))}
          </div>
        </ConexaoCard>

        <ConexaoCard
          Icon={Syringe}
          titulo="Vacinas Recomendadas"
          gradient="from-green-600 to-lime-800"
          count={vacinasSugeridas.length}
          empty={isBio ? "Sem vacinas configuradas." : "Aplicável apenas a riscos biológicos."}
        >
          {vacinasSugeridas.map((v) => (
            <div key={v} className="flex items-center gap-2 py-1.5 text-sm text-white/90">
              <div className="h-1.5 w-1.5 rounded-full bg-lime-400" />
              {v}
            </div>
          ))}
        </ConexaoCard>
      </div>

      {/* MEDIDAS DE CONTROLE */}
      {medidas.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-cyan-300" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white/70">Medidas de Controle Padrão</h3>
          </div>
          <ul className="space-y-1.5">
            {medidas.map((m) => (
              <li key={m} className="flex items-start gap-2 text-sm text-white/85">
                <ArrowRight className="h-3.5 w-3.5 mt-1 text-cyan-400 shrink-0" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RODAPÉ EXPLICATIVO */}
      <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.05] p-4 text-[11px] text-white/70 leading-relaxed">
        <b className="text-fuchsia-200">Como o SIGMO usa isso:</b> quando um cargo é vinculado a este
        risco (via <em>Matriz de Riscos</em> ou <em>PGR</em>), o Safety Engine passa a exigir os exames
        obrigatórios acima, verifica se o colaborador tem os EPIs entregues e bloqueia o acesso na
        Portaria caso algo esteja pendente.
      </div>
    </div>
  );
}

function ConexaoCard({
  Icon, titulo, gradient, count, empty, children,
}: {
  Icon: typeof Zap;
  titulo: string;
  gradient: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur overflow-hidden transition hover:border-white/20 hover:shadow-xl">
      <div className={`px-4 py-3 bg-gradient-to-r ${gradient} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-white" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">{titulo}</h3>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/30 text-white">
          {count}
        </span>
      </div>
      <div className="p-4 min-h-[110px]">
        {count === 0 ? <div className="text-[11px] text-white/40 italic">{empty}</div> : children}
      </div>
    </div>
  );
}

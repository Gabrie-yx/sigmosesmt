import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Target, Users, ShieldCheck, ClipboardCheck, GraduationCap, Activity, AlertTriangle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes-indicadores")({
  component: ConfigIndicadores,
});

const DIAS_SEMANA = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
];

function ConfigIndicadores() {
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["company-settings-indicadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: efetivo } = useQuery({
    queryKey: ["efetivo-ativo"],
    queryFn: async () => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("status", "ATIVO");
      return count ?? 0;
    },
  });

  const [ddsSemana, setDdsSemana] = useState<number>(3);
  const [ddsDias, setDdsDias] = useState<number[]>([1, 3, 5]);
  const [inspPct, setInspPct] = useState<number>(90);
  const [treinPct, setTreinPct] = useState<number>(90);
  const [asoPct, setAsoPct] = useState<number>(95);
  const [acidTaxa, setAcidTaxa] = useState<number>(2);
  const [diasMax, setDiasMax] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDdsSemana(Number(settings.meta_dds_semana ?? 3));
    setDdsDias((settings.meta_dds_dias_semana ?? [1, 3, 5]) as number[]);
    setInspPct(Number(settings.meta_inspecoes_pct ?? 90));
    setTreinPct(Number(settings.meta_treinamentos_pct ?? 90));
    setAsoPct(Number(settings.meta_aso_pct ?? 95));
    setAcidTaxa(Number(settings.meta_acidentes_taxa_max_pct ?? 2));
    setDiasMax(Number(settings.meta_dias_perdidos_max_mes ?? 5));
  }, [settings]);

  const toggleDia = (v: number) => {
    setDdsDias((cur) => cur.includes(v) ? cur.filter((d) => d !== v) : [...cur, v].sort());
  };

  // Cálculo de pré-visualização
  const previewPlanejado = useMemo(() => {
    // semanas no mês atual × dias configurados
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    let count = 0;
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      if (ddsDias.includes(d.getDay())) count++;
    }
    return count;
  }, [ddsDias]);

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("company_settings")
      .update({
        meta_dds_semana: ddsSemana,
        meta_dds_dias_semana: ddsDias,
        meta_inspecoes_pct: inspPct,
        meta_treinamentos_pct: treinPct,
        meta_aso_pct: asoPct,
        meta_acidentes_taxa_max_pct: acidTaxa,
        meta_dias_perdidos_max_mes: diasMax,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Metas atualizadas com sucesso!");
    refetch();
  };

  if (isLoading) {
    return <div className="p-6 text-slate-300 text-sm">Carregando…</div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-[radial-gradient(ellipse_at_top,_#0b1426_0%,_#070b16_55%,_#04070f_100%)]">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link to="/app/painel" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-cyan-300 mb-1">
              <ArrowLeft className="h-3 w-3" /> Voltar ao Painel SESMT
            </Link>
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <Target className="h-6 w-6 text-cyan-400" />
              Configuração de Metas · Indicadores Oficiais
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              6 indicadores obrigatórios da auditoria SGI-SST · NBR 14280 · ISO 45001 · NR-01/07
            </p>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-gradient-to-br from-cyan-500 to-cyan-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/30 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando…" : "Salvar Metas"}
          </button>
        </div>

        {/* Efetivo automático */}
        <div className="rounded-xl border border-emerald-500/30 bg-slate-900/40 backdrop-blur-md p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/80">Efetivo Médio Mensal · Cálculo Automático</div>
                <div className="text-3xl font-black text-emerald-200 tabular-nums">
                  {efetivo ?? 0} <span className="text-sm font-bold text-emerald-400/70">funcionários ativos</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Fonte: módulo Funcionários (status = ATIVO). Usado no cálculo da Taxa de Acidentes/Efetivo.
                </div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-500 max-w-xs text-right">
              Para alterar, gerencie os funcionários no módulo <Link to="/app/employees" className="text-cyan-400 underline">Funcionários</Link>.
            </div>
          </div>
        </div>

        {/* DDS */}
        <Section
          icon={Activity}
          title="DDS · Diálogo Diário de Segurança"
          subtitle="Meta: quantos DDS por semana e em quais dias você aplica"
          accent="#22d3ee"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Meta de DDS por semana">
              <input
                type="number" min={1} max={7}
                value={ddsSemana}
                onChange={(e) => setDdsSemana(Number(e.target.value))}
                className="w-24 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 text-slate-100 text-lg font-black tabular-nums"
              />
              <span className="ml-3 text-[11px] text-slate-400">DDS por semana</span>
            </Field>

            <Field label="Dias da semana em que o DDS é aplicado">
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_SEMANA.map((d) => {
                  const active = ddsDias.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      onClick={() => toggleDia(d.v)}
                      className={`px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wider transition-all ${
                        active
                          ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/40"
                          : "bg-slate-800/60 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[12px] text-cyan-100">
            <strong>Pré-visualização:</strong> Com a configuração atual ({ddsDias.length} dias/semana), o sistema vai considerar{" "}
            <span className="font-black text-cyan-300">{previewPlanejado} DDS planejados</span> no mês corrente.
            Se você lançar a maior parte deles, o indicador fica verde (≥85%).
          </div>
        </Section>

        {/* Inspeções */}
        <Section
          icon={ClipboardCheck}
          title="Inspeções Planejadas · Consolidado"
          subtitle="Meta % de inspeções executadas vs planejadas (extintores + equipamentos móveis + checklists)"
          accent="#10b981"
        >
          <Field label="Meta mínima de cumprimento (%)">
            <input
              type="number" min={0} max={100}
              value={inspPct}
              onChange={(e) => setInspPct(Number(e.target.value))}
              className="w-24 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 text-slate-100 text-lg font-black tabular-nums"
            />
            <span className="ml-3 text-[11px] text-slate-400">% mínimo aceitável</span>
          </Field>
        </Section>

        {/* Treinamentos */}
        <Section
          icon={GraduationCap}
          title="Treinamentos NR · Em dia"
          subtitle="Meta % de funcionários com treinamentos NR válidos (NR-01)"
          accent="#a78bfa"
        >
          <Field label="Meta mínima (%)">
            <input
              type="number" min={0} max={100}
              value={treinPct}
              onChange={(e) => setTreinPct(Number(e.target.value))}
              className="w-24 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 text-slate-100 text-lg font-black tabular-nums"
            />
            <span className="ml-3 text-[11px] text-slate-400">% mínimo aceitável</span>
          </Field>
        </Section>

        {/* ASO */}
        <Section
          icon={ShieldCheck}
          title="ASO · PCMSO"
          subtitle="Meta % de funcionários ativos com ASO válido (NR-07)"
          accent="#fbbf24"
        >
          <Field label="Meta mínima (%)">
            <input
              type="number" min={0} max={100}
              value={asoPct}
              onChange={(e) => setAsoPct(Number(e.target.value))}
              className="w-24 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 text-slate-100 text-lg font-black tabular-nums"
            />
            <span className="ml-3 text-[11px] text-slate-400">% mínimo aceitável</span>
          </Field>
        </Section>

        {/* Acidentes */}
        <Section
          icon={AlertTriangle}
          title="Acidentes · Indicadores Reativos"
          subtitle="Substituem TF/TG enquanto não houver controle de HHT (ponto eletrônico)"
          accent="#f43f5e"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Taxa máxima de acidentes / efetivo (%)">
              <input
                type="number" min={0} step={0.1}
                value={acidTaxa}
                onChange={(e) => setAcidTaxa(Number(e.target.value))}
                className="w-24 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 text-slate-100 text-lg font-black tabular-nums"
              />
              <span className="ml-3 text-[11px] text-slate-400">% / mês</span>
            </Field>
            <Field label="Máximo de dias perdidos por mês">
              <input
                type="number" min={0}
                value={diasMax}
                onChange={(e) => setDiasMax(Number(e.target.value))}
                className="w-24 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 text-slate-100 text-lg font-black tabular-nums"
              />
              <span className="ml-3 text-[11px] text-slate-400">dias / mês</span>
            </Field>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-100">
            <strong>Nota auditor:</strong> Quando a empresa implantar controle de ponto eletrônico, migrar para TF/TG conforme NBR 14280 (Plano de Evolução do SGI-SST).
          </div>
        </Section>

        {/* Botão salvar final */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="px-6 py-3 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white text-sm font-black uppercase tracking-wider shadow-lg shadow-cyan-500/30 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar Todas as Metas"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, accent, children }: {
  icon: any; title: string; subtitle: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-5">
      <div className="flex items-start gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}20`, boxShadow: `0 0 18px ${accent}40, inset 0 1px 0 ${accent}40` }}>
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        <div>
          <div className="text-sm font-black text-slate-100">{title}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-2">{label}</div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
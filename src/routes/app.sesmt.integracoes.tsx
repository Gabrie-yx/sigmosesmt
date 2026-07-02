import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GraduationCap, Plus, FileSpreadsheet, Printer, Building2 } from "lucide-react";
import { IntegracaoDialog } from "@/components/employees/integracao-dialog";
import { EmpresaIntegracoesDialog } from "@/components/integracao/empresa-detalhe-dialog";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";
import { fetchSignatureAsCleanDataUrl } from "@/lib/signature-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/integracoes")({
  component: IntegracoesPage,
});

type Periodo = "HOJE" | "SEMANA" | "MES" | "ANO" | "CUSTOM";

function rangeFor(p: Periodo, ini: string, fim: string): [string, string] {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "HOJE") return [iso(today), iso(today)];
  if (p === "SEMANA") {
    const i = new Date(today); i.setDate(today.getDate() - 7);
    return [iso(i), iso(today)];
  }
  if (p === "MES") {
    const i = new Date(today.getFullYear(), today.getMonth(), 1);
    return [iso(i), iso(today)];
  }
  if (p === "ANO") {
    const i = new Date(today.getFullYear(), 0, 1);
    return [iso(i), iso(today)];
  }
  return [ini, fim];
}

function IntegracoesPage() {
  const [periodo, setPeriodo] = useState<Periodo>("MES");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [open, setOpen] = useState(false);
  const [empresaSel, setEmpresaSel] = useState<string | null>(null);
  const [de, ate] = rangeFor(periodo, ini, fim);

  const { data: rows = [], refetch, isLoading } = useQuery({
    queryKey: ["integracoes-agregado", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracoes")
        .select("id, data_integracao, carga_horaria_h, instrutor_nome, local, conteudo_programatico, integracao_participantes(id, nome_snapshot, empresa_snapshot, cargo_snapshot, assinatura_snapshot)")
        .gte("data_integracao", de)
        .lte("data_integracao", ate)
        .order("data_integracao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contagem de ativos por empresa (denominador do semáforo)
  const { data: ativosPorEmpresa = {} } = useQuery({
    queryKey: ["employees-ativos-por-empresa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("companies(name)")
        .eq("status", "ATIVO")
        .limit(5000);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const n = r.companies?.name;
        if (!n) return;
        map[n] = (map[n] ?? 0) + 1;
      });
      return map;
    },
  });

  const filtradas = useMemo(() => {
    if (!empresa.trim()) return rows;
    const q = empresa.toLowerCase();
    return rows
      .map((r: any) => ({
        ...r,
        integracao_participantes: r.integracao_participantes.filter((p: any) =>
          (p.empresa_snapshot ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((r: any) => r.integracao_participantes.length > 0);
  }, [rows, empresa]);

  // Agrega por empresa: quem foi integrado (únicos) + última data + nº sessões
  const porEmpresa = useMemo(() => {
    const map = new Map<string, { nome: string; integrados: Set<string>; ultimaData: string; sessoes: Set<string> }>();
    filtradas.forEach((r: any) => {
      (r.integracao_participantes ?? []).forEach((p: any) => {
        const nome = p.empresa_snapshot ?? "— Sem empresa —";
        const cur = map.get(nome) ?? { nome, integrados: new Set<string>(), ultimaData: "", sessoes: new Set<string>() };
        cur.integrados.add(p.nome_snapshot);
        cur.sessoes.add(r.id);
        if (!cur.ultimaData || r.data_integracao > cur.ultimaData) cur.ultimaData = r.data_integracao;
        map.set(nome, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.integrados.size - a.integrados.size);
  }, [filtradas]);

  const totalSessoes = filtradas.length;
  const totalPart = filtradas.reduce((s: number, r: any) => s + r.integracao_participantes.length, 0);

  async function exportarPdf(r: any) {
    try {
      const participantes = await Promise.all(
        r.integracao_participantes.map(async (p: any) => ({
          nome: p.nome_snapshot,
          empresa: p.empresa_snapshot ?? "",
          cargo: p.cargo_snapshot ?? "",
          assinaturaDataUrl: await fetchSignatureAsCleanDataUrl(p.assinatura_snapshot),
        })),
      );
      participantes.sort((a: any, b: any) => (a.empresa || "").localeCompare(b.empresa) || a.nome.localeCompare(b.nome));
      const [y, m, d] = r.data_integracao.split("-");
      const dataBR = `${d}/${m}/${y}`;
      const pdf = gerarListaPresenca({
        titulo: "INTEGRAÇÃO DE SEGURANÇA — NR-01",
        instrutor: r.instrutor_nome,
        assunto: "Integração de Segurança do Trabalho — conteúdo NR-01 item 1.5.7",
        tipo: "IN COMPANY",
        data: dataBR,
        cargaHoraria: `${r.carga_horaria_h}h`,
        instituicao: "DMN — SESMT",
        local: r.local ?? "DMN — Manaus/AM",
        participantes,
        agruparPorEmpresa: true,
        codigo: "FOR-SEG-INT-01",
        revisao: "00",
        dataDocumento: dataBR,
      });
      pdf.save(`integracao_${r.data_integracao}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    }
  }

  async function exportarRelatorioPeriodo() {
    if (filtradas.length === 0) return toast.error("Sem integrações no período");
    const participantes: any[] = [];
    for (const r of filtradas) {
      for (const p of r.integracao_participantes as any[]) {
        participantes.push({
          nome: p.nome_snapshot,
          empresa: p.empresa_snapshot ?? "— Sem empresa —",
          cargo: `${p.cargo_snapshot ?? ""} · ${r.data_integracao.split("-").reverse().join("/")}`,
          assinaturaDataUrl: await fetchSignatureAsCleanDataUrl(p.assinatura_snapshot),
        });
      }
    }
    participantes.sort((a, b) => (a.empresa || "").localeCompare(b.empresa) || a.nome.localeCompare(b.nome));
    const [yi, mi, di] = de.split("-");
    const [yf, mf, df] = ate.split("-");
    const pdf = gerarListaPresenca({
      titulo: "RELATÓRIO DE INTEGRAÇÕES NR-01",
      instrutor: filtradas[0].instrutor_nome,
      assunto: `Consolidado do período ${di}/${mi}/${yi} → ${df}/${mf}/${yf}${empresa ? ` — filtro: ${empresa}` : ""}`,
      tipo: "IN COMPANY",
      data: `${df}/${mf}/${yf}`,
      cargaHoraria: "—",
      instituicao: "DMN — SESMT",
      local: "DMN — Manaus/AM",
      participantes,
      agruparPorEmpresa: true,
      codigo: "FOR-SEG-INT-01",
      revisao: "00",
      dataDocumento: `${df}/${mf}/${yf}`,
    });
    pdf.save(`relatorio_integracoes_${de}_${ate}.pdf`);
  }

  function exportarExcel() {
    const linhas = [
      ["Data", "Empresa", "Funcionário", "Cargo", "Instrutor", "CH (h)", "Local"],
      ...filtradas.flatMap((r: any) =>
        r.integracao_participantes.map((p: any) => [
          r.data_integracao,
          p.empresa_snapshot ?? "",
          p.nome_snapshot,
          p.cargo_snapshot ?? "",
          r.instrutor_nome,
          String(r.carga_horaria_h),
          r.local ?? "",
        ]),
      ),
    ];
    const csv = linhas.map((l) => l.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `integracoes_${de}_${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-6 md:px-14 py-8">
        <Link to="/app/sesmt" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[rgba(245,225,225,0.55)] hover:text-brand transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para SESMT
        </Link>

        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-black uppercase tracking-widest text-rose-50 flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-emerald-400" /> Integrações NR-01
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportarRelatorioPeriodo} disabled={filtradas.length === 0}>
              <Printer className="h-4 w-4 mr-1" /> Relatório do período
            </Button>
            <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Nova Integração
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="p-4 glass-card"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessões</div><div className="text-3xl font-black text-emerald-400">{totalSessoes}</div></Card>
          <Card className="p-4 glass-card"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Participantes</div><div className="text-3xl font-black text-emerald-400">{totalPart}</div></Card>
          <Card className="p-4 glass-card"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresas</div><div className="text-3xl font-black text-emerald-400">{porEmpresa.length}</div></Card>
          <Card className="p-4 glass-card"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Período</div><div className="text-sm font-bold text-rose-50">{de} → {ate}</div></Card>
        </div>

        {/* Filtros */}
        <Card className="p-4 mb-4 glass-card">
          <div className="flex flex-wrap items-end gap-2">
            {(["HOJE", "SEMANA", "MES", "ANO", "CUSTOM"] as Periodo[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={periodo === p ? "default" : "outline"}
                onClick={() => setPeriodo(p)}
              >
                {p}
              </Button>
            ))}
            {periodo === "CUSTOM" && (
              <>
                <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-40" />
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
              </>
            )}
            <Input placeholder="Filtrar por empresa…" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-60" />
            <Button variant="outline" size="sm" onClick={exportarExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </Card>

        {/* Cards por EMPRESA (clique para ver participantes) */}
        <h2 className="text-[11px] font-black uppercase tracking-widest text-[rgba(245,225,225,0.65)] mb-2">Por empresa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {porEmpresa.map((c) => {
            const totalAtivos = ativosPorEmpresa[c.nome] ?? 0;
            const cobertura = totalAtivos > 0 ? Math.round((c.integrados.size / totalAtivos) * 100) : null;
            const semColor =
              cobertura === null ? "border-white/15 text-rose-50/80"
              : cobertura >= 90 ? "border-emerald-400/60 text-emerald-300"
              : cobertura >= 60 ? "border-amber-400/60 text-amber-300"
              : "border-rose-400/60 text-rose-300";
            return (
              <button key={c.nome} onClick={() => setEmpresaSel(c.nome)} className="text-left">
                <Card className="p-4 glass-card hover:border-emerald-400/40 transition-colors h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-rose-50 truncate">{c.nome}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                        Última: {c.ultimaData.split("-").reverse().join("/")} · {c.sessoes.size} sessão(ões)
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge className="bg-emerald-600 text-white">{c.integrados.size} integrados</Badge>
                        {cobertura !== null && (
                          <Badge variant="outline" className={semColor}>
                            {c.integrados.size}/{totalAtivos} · {cobertura}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
          {!isLoading && porEmpresa.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground glass-card sm:col-span-2 lg:col-span-3">
              Nenhuma integração no período.
            </Card>
          )}
        </div>

        {/* Lista bruta por sessão (histórico) */}
        <h2 className="text-[11px] font-black uppercase tracking-widest text-[rgba(245,225,225,0.65)] mb-2">Sessões no período</h2>
        <div className="space-y-2">
          {isLoading && <div className="text-center text-sm text-muted-foreground py-8">Carregando…</div>}
          {filtradas.map((r: any) => (
            <Card key={r.id} className="p-4 glass-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-600 text-white">{r.data_integracao.split("-").reverse().join("/")}</Badge>
                    <span className="text-sm font-bold text-rose-50">{r.instrutor_nome}</span>
                    <Badge variant="outline">{r.carga_horaria_h}h</Badge>
                    <Badge variant="outline">{r.integracao_participantes.length} pessoas</Badge>
                    {r.local && <span className="text-xs text-muted-foreground">{r.local}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {r.integracao_participantes.slice(0, 5).map((p: any) => p.nome_snapshot).join(", ")}
                    {r.integracao_participantes.length > 5 ? `, +${r.integracao_participantes.length - 5}…` : ""}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => exportarPdf(r)}>
                  <Printer className="h-4 w-4 mr-1" /> PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <IntegracaoDialog open={open} onOpenChange={setOpen} onSaved={() => refetch()} />
      <EmpresaIntegracoesDialog
        open={!!empresaSel}
        onOpenChange={(v) => !v && setEmpresaSel(null)}
        empresa={empresaSel ? { nome: empresaSel } : null}
        periodoIni={de}
        periodoFim={ate}
      />
    </div>
  );
}
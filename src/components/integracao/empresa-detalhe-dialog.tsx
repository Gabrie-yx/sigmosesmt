import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, Printer, Eye, Download, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";
import { fetchSignatureAsCleanDataUrl } from "@/lib/signature-utils";

type Participante = {
  id: string;
  integracao_id: string;
  employee_id: string | null;
  nome_snapshot: string;
  empresa_snapshot: string | null;
  cargo_snapshot: string | null;
  assinatura_snapshot: string | null;
  integracoes: {
    id: string;
    data_integracao: string;
    instrutor_nome: string;
    carga_horaria_h: number;
    local: string | null;
    conteudo_programatico: string | null;
  };
};

export function EmpresaIntegracoesDialog({
  open,
  onOpenChange,
  empresa,
  periodoIni,
  periodoFim,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: { nome: string } | null;
  periodoIni: string;
  periodoFim: string;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["integracao-empresa", empresa?.nome, periodoIni, periodoFim],
    enabled: open && !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracao_participantes")
        .select("id, integracao_id, employee_id, nome_snapshot, empresa_snapshot, cargo_snapshot, assinatura_snapshot, integracoes!inner(id, data_integracao, instrutor_nome, carga_horaria_h, local, conteudo_programatico)")
        .eq("empresa_snapshot", empresa!.nome)
        .gte("integracoes.data_integracao", periodoIni)
        .lte("integracoes.data_integracao", periodoFim);
      if (error) throw error;
      return (data ?? []) as unknown as Participante[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const arr = !q ? rows : rows.filter((r) =>
      r.nome_snapshot.toLowerCase().includes(q) ||
      (r.cargo_snapshot ?? "").toLowerCase().includes(q),
    );
    return [...arr].sort((a, b) =>
      b.integracoes.data_integracao.localeCompare(a.integracoes.data_integracao) ||
      a.nome_snapshot.localeCompare(b.nome_snapshot),
    );
  }, [rows, busca]);

  // Restaura a assinatura oficial do funcionário (fonte da verdade = employees.assinatura_url)
  const restaurarOficial = useMutation({
    mutationFn: async (p: Participante) => {
      if (!p.employee_id) throw new Error("Participante sem vínculo com funcionário");
      const { data: emp, error: eErr } = await supabase
        .from("employees")
        .select("assinatura_url")
        .eq("id", p.employee_id)
        .maybeSingle();
      if (eErr) throw eErr;
      if (!emp?.assinatura_url) throw new Error("Funcionário não tem assinatura oficial cadastrada no perfil");
      const { error } = await supabase
        .from("integracao_participantes")
        .update({ assinatura_snapshot: emp.assinatura_url })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Assinatura oficial restaurada");
      await qc.invalidateQueries({ queryKey: ["integracao-empresa"] });
      await qc.invalidateQueries({ queryKey: ["integracoes-agregado"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao restaurar"),
  });

  async function baixarPdfIndividual(p: Participante) {
    try {
      const [y, m, d] = p.integracoes.data_integracao.split("-");
      const dataBR = `${d}/${m}/${y}`;
      const pdf = gerarListaPresenca({
        titulo: "INTEGRAÇÃO DE SEGURANÇA — NR-01",
        instrutor: p.integracoes.instrutor_nome,
        assunto: "Integração de Segurança do Trabalho — conteúdo NR-01 item 1.5.7",
        tipo: "IN COMPANY",
        data: dataBR,
        cargaHoraria: `${p.integracoes.carga_horaria_h}h`,
        instituicao: "DMN — SESMT",
        local: p.integracoes.local ?? "DMN — Manaus/AM",
        participantes: [{
          nome: p.nome_snapshot,
          empresa: p.empresa_snapshot ?? "",
          cargo: p.cargo_snapshot ?? "",
          assinaturaDataUrl: await fetchSignatureAsCleanDataUrl(p.assinatura_snapshot),
        }],
        agruparPorEmpresa: true,
        codigo: "FOR-SEG-INT-01",
        revisao: "00",
        dataDocumento: dataBR,
      });
      pdf.save(`integracao_${p.nome_snapshot.replace(/\s+/g, "_")}_${p.integracoes.data_integracao}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    }
  }

  async function imprimirPdfIndividual(p: Participante) {
    try {
      const [y, m, d] = p.integracoes.data_integracao.split("-");
      const dataBR = `${d}/${m}/${y}`;
      const pdf = gerarListaPresenca({
        titulo: "INTEGRAÇÃO DE SEGURANÇA — NR-01",
        instrutor: p.integracoes.instrutor_nome,
        assunto: "Integração de Segurança do Trabalho — conteúdo NR-01 item 1.5.7",
        tipo: "IN COMPANY",
        data: dataBR,
        cargaHoraria: `${p.integracoes.carga_horaria_h}h`,
        instituicao: "DMN — SESMT",
        local: p.integracoes.local ?? "DMN — Manaus/AM",
        participantes: [{
          nome: p.nome_snapshot,
          empresa: p.empresa_snapshot ?? "",
          cargo: p.cargo_snapshot ?? "",
          assinaturaDataUrl: await fetchSignatureAsCleanDataUrl(p.assinatura_snapshot),
        }],
        agruparPorEmpresa: true,
        codigo: "FOR-SEG-INT-01",
        revisao: "00",
        dataDocumento: dataBR,
      });
      const url = pdf.output("bloburl");
      const w = window.open(url as any, "_blank");
      if (w) setTimeout(() => w.print(), 500);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao imprimir");
    }
  }

  async function exportarConsolidadoEmpresa() {
    if (filtrados.length === 0) return toast.error("Sem participantes no período");
    const participantes = await Promise.all(
      filtrados.map(async (p) => ({
        nome: p.nome_snapshot,
        empresa: p.empresa_snapshot ?? "",
        cargo: p.cargo_snapshot ?? "",
        assinaturaDataUrl: await fetchSignatureAsCleanDataUrl(p.assinatura_snapshot),
      })),
    );
    const [yi, mi, di] = periodoIni.split("-");
    const [yf, mf, df] = periodoFim.split("-");
    const primeira = filtrados[filtrados.length - 1].integracoes;
    const pdf = gerarListaPresenca({
      titulo: `INTEGRAÇÕES NR-01 — ${empresa?.nome ?? ""}`,
      instrutor: primeira.instrutor_nome,
      assunto: `Consolidado de integrações no período ${di}/${mi}/${yi} → ${df}/${mf}/${yf}`,
      tipo: "IN COMPANY",
      data: `${df}/${mf}/${yf}`,
      cargaHoraria: `${primeira.carga_horaria_h}h`,
      instituicao: "DMN — SESMT",
      local: primeira.local ?? "DMN — Manaus/AM",
      participantes,
      agruparPorEmpresa: true,
      codigo: "FOR-SEG-INT-01",
      revisao: "00",
      dataDocumento: `${df}/${mf}/${yf}`,
    });
    pdf.save(`integracoes_${(empresa?.nome ?? "empresa").replace(/\s+/g, "_")}_${periodoIni}_${periodoFim}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-400" />
            {empresa?.nome ?? "—"}
            <Badge variant="outline" className="ml-2">{filtrados.length} integrados</Badge>
            <Badge variant="outline">{periodoIni} → {periodoFim}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo…" className="pl-8" />
          </div>
          <Button variant="outline" onClick={exportarConsolidadoEmpresa} disabled={filtrados.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> Consolidado
          </Button>
        </div>

        <div className="flex-1 overflow-auto mt-3 space-y-2 pr-1">
          {isLoading && <div className="text-sm text-center text-muted-foreground py-8">Carregando…</div>}
          {!isLoading && filtrados.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground glass-card">Nenhum participante no período.</Card>
          )}
          {filtrados.map((p) => (
            <Card key={p.id} className="p-3 glass-card">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-rose-50 truncate">{p.nome_snapshot}</span>
                    <Badge className="bg-emerald-600 text-white">{p.integracoes.data_integracao.split("-").reverse().join("/")}</Badge>
                    <Badge variant="outline">{p.integracoes.carga_horaria_h}h</Badge>
                    {p.cargo_snapshot && <span className="text-[11px] text-muted-foreground truncate">{p.cargo_snapshot}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Instrutor: <span className="text-rose-50/80">{p.integracoes.instrutor_nome}</span>
                    {p.integracoes.local ? <> · {p.integracoes.local}</> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.assinatura_snapshot ? (
                    <button type="button" onClick={() => setPreview(p.assinatura_snapshot)} className="h-10 w-24 rounded bg-white/95 border border-white/20 flex items-center justify-center overflow-hidden" title="Ver assinatura">
                      <img src={p.assinatura_snapshot} alt="assinatura" className="max-h-9 max-w-[92px] object-contain" />
                    </button>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-300">S/ ASS</Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setPreview(p.assinatura_snapshot)} disabled={!p.assinatura_snapshot} title="Visualizar assinatura">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => baixarPdfIndividual(p)} title="Baixar PDF individual">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => imprimirPdfIndividual(p)} title="Imprimir">
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-emerald-300 hover:text-emerald-200"
                    onClick={() => {
                      if (confirm(`Restaurar a assinatura oficial de ${p.nome_snapshot} (a que está no perfil do funcionário)?`))
                        restaurarOficial.mutate(p);
                    }}
                    title="Restaurar assinatura oficial do perfil">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>

        {preview && (
          <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
            <DialogContent className="max-w-2xl bg-white">
              <DialogHeader><DialogTitle>Assinatura</DialogTitle></DialogHeader>
              <div className="flex items-center justify-center p-6">
                <img src={preview} alt="assinatura" className="max-h-[60vh] max-w-full object-contain" />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
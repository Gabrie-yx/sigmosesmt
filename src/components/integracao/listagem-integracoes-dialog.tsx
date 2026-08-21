import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gerarListaPresenca } from "@/lib/lista-presenca-pdf";
import { fetchSignatureAsCleanDataUrl } from "@/lib/signature-utils";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";

type Escopo = "TUDO" | "PERIODO";

function brDate(iso: string) {
  return iso.split("-").reverse().join("/");
}

export function ListagemIntegracoesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [escopo, setEscopo] = useState<Escopo>("TUDO");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [empresa, setEmpresa] = useState("TODAS");
  const [agrupar, setAgrupar] = useState("SIM");
  const [gerando, setGerando] = useState(false);
  const [doc, setDoc] = useState<jsPDF | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["integracoes-empresas-distintas"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracao_participantes")
        .select("empresa_snapshot")
        .limit(5000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.empresa_snapshot && set.add(r.empresa_snapshot));
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });

  const periodoLabel = useMemo(() => {
    if (escopo === "TUDO") return "Todo o histórico";
    if (!de || !ate) return "—";
    return `${brDate(de)} → ${brDate(ate)}`;
  }, [escopo, de, ate]);

  async function gerar() {
    if (escopo === "PERIODO" && (!de || !ate)) {
      toast.error("Informe data inicial e final.");
      return;
    }
    setGerando(true);
    try {
      let q = supabase
        .from("integracoes")
        .select(
          "id, data_integracao, carga_horaria_h, instrutor_nome, local, integracao_participantes(id, nome_snapshot, empresa_snapshot, cargo_snapshot, assinatura_snapshot)",
        )
        .order("data_integracao", { ascending: true })
        .limit(2000);
      if (escopo === "PERIODO") q = q.gte("data_integracao", de).lte("data_integracao", ate);

      const { data, error } = await q;
      if (error) throw error;

      const sessoes = (data ?? []).map((r: any) => ({
        ...r,
        integracao_participantes: (r.integracao_participantes ?? []).filter((p: any) =>
          empresa === "TODAS" ? true : (p.empresa_snapshot ?? "") === empresa,
        ),
      })).filter((r: any) => r.integracao_participantes.length > 0);

      if (sessoes.length === 0) {
        toast.error("Nenhuma integração encontrada com esses filtros.");
        return;
      }

      const participantes: any[] = [];
      for (const r of sessoes) {
        for (const p of r.integracao_participantes as any[]) {
          participantes.push({
            nome: p.nome_snapshot,
            empresa: p.empresa_snapshot ?? "— Sem empresa —",
            cargo: `${p.cargo_snapshot ?? ""} · ${brDate(r.data_integracao)}`,
            assinaturaDataUrl: await fetchSignatureAsCleanDataUrl(p.assinatura_snapshot),
          });
        }
      }
      participantes.sort(
        (a, b) => a.empresa.localeCompare(b.empresa, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"),
      );

      const ultima = sessoes[sessoes.length - 1];
      const hoje = new Date().toLocaleDateString("pt-BR");
      const pdf = gerarListaPresenca({
        titulo: "LISTA DE PRESENÇA — INTEGRAÇÃO DE SEGURANÇA (NR-01)",
        instrutor: ultima.instrutor_nome ?? "",
        assunto:
          escopo === "TUDO"
            ? `Consolidado de integrações — todo o histórico${empresa !== "TODAS" ? ` — ${empresa}` : ""}`
            : `Consolidado de integrações — ${brDate(de)} a ${brDate(ate)}${empresa !== "TODAS" ? ` — ${empresa}` : ""}`,
        tipo: "IN COMPANY",
        data: brDate(ultima.data_integracao),
        cargaHoraria: String(ultima.carga_horaria_h ?? "—"),
        instituicao: "DMN — SESMT",
        local: ultima.local ?? "DMN — Manaus/AM",
        participantes,
        agruparPorEmpresa: agrupar === "SIM",
        codigo: "FORCP-GP-05",
        revisao: "00",
        dataDocumento: hoje,
      });
      setDoc(pdf);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar a listagem.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" /> Listagem de Integrações (FORCP-GP-05)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Abrangência</Label>
              <Select value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TUDO">Tudo (todo o histórico)</SelectItem>
                  <SelectItem value="PERIODO">Período específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {escopo === "PERIODO" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Até</Label>
                  <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Separar por empresa (nova folha a cada empresa)</Label>
              <Select value={agrupar} onValueChange={setAgrupar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">Sim — uma lista por empresa</SelectItem>
                  <SelectItem value="NAO">Não — lista única contínua</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Período: {periodoLabel} · Empresa: {empresa === "TODAS" ? "Todas" : empresa}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={gerar} disabled={gerando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {gerando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Gerar listagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={!!doc}
        onClose={() => setDoc(null)}
        doc={doc}
        fileName={`listagem_integracoes_${escopo === "TUDO" ? "geral" : `${de}_${ate}`}.pdf`}
        title="Listagem de Integrações — FORCP-GP-05"
      />
    </>
  );
}

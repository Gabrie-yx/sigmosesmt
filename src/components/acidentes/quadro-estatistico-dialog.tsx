import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { FileText, Loader2, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";
import { gerarForSeg09, calcularQuadroEstatistico } from "@/lib/pdf-acidentes";

export function QuadroEstatisticoDialog({
  open,
  onOpenChange,
  anoInicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anoInicial?: number;
}) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoInicial ?? anoAtual);
  const [companyId, setCompanyId] = useState<string>("TODAS");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelCargo, setResponsavelCargo] = useState("Técnico de Segurança do Trabalho");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [doc, setDoc] = useState<jsPDF | null>(null);
  const [gerando, setGerando] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-quadro-estatistico"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,razao_social,cnpj,logradouro,numero,bairro,cep,cnae_principal,grau_risco")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: acidentes = [], isLoading: loadA } = useQuery({
    queryKey: ["quadro-acidentes", ano],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acidentes_trabalho")
        .select("data_acidente,tipo,dias_perdidos,dias_debitados,company_id")
        .gte("data_acidente", `${ano}-01-01`)
        .lte("data_acidente", `${ano}-12-31`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: hht = [], isLoading: loadH } = useQuery({
    queryKey: ["quadro-hht", ano],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hht_mensal")
        .select("ano,mes,hht,empregados_medio,company_id")
        .eq("ano", ano);
      if (error) throw error;
      return data ?? [];
    },
  });

  const anos = useMemo(() => {
    const set = new Set<number>([anoAtual, anoAtual - 1, anoAtual - 2]);
    if (anoInicial) set.add(anoInicial);
    return Array.from(set).sort((a, b) => b - a);
  }, [anoAtual, anoInicial]);

  const filtrados = useMemo(() => {
    if (companyId === "TODAS") return { acidentes, hht };
    return {
      acidentes: acidentes.filter((a) => a.company_id === companyId),
      hht: hht.filter((h) => h.company_id === companyId),
    };
  }, [acidentes, hht, companyId]);

  const previa = useMemo(
    () => calcularQuadroEstatistico(ano, filtrados.acidentes, filtrados.hht),
    [ano, filtrados],
  );

  const empresaSel = companies.find((c) => c.id === companyId);

  const gerar = () => {
    if (previa.total.hht <= 0 && previa.total.absoluto === 0) {
      toast.error(
        `Sem dados em ${ano}${companyId === "TODAS" ? "" : " para esta empresa"}. Lance o HHT mensal antes de emitir.`,
      );
      return;
    }
    if (previa.total.hht <= 0) {
      toast.warning("HHT não lançado no período — TF e TG sairão zerados.");
    }
    setGerando(true);
    try {
      const d = gerarForSeg09({
        ano,
        acidentes: filtrados.acidentes,
        hht: filtrados.hht,
        responsavel: responsavel || null,
        responsavelCargo: responsavel ? responsavelCargo || null : null,
        assinaturaDataUrl: assinatura,
        empresa: empresaSel
          ? {
              nome: empresaSel.razao_social || empresaSel.name,
              cnpj: empresaSel.cnpj,
              endereco: [empresaSel.logradouro, empresaSel.numero].filter(Boolean).join(", "),
              bairro: empresaSel.bairro,
              cep: empresaSel.cep,
              cnae: empresaSel.cnae_principal,
              grau_risco: empresaSel.grau_risco != null ? String(empresaSel.grau_risco).padStart(2, "0") : null,
            }
          : undefined,
      });
      setDoc(d);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar o quadro.");
    } finally {
      setGerando(false);
    }
  };

  const carregando = loadA || loadH;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Emitir Quadro Estatístico — FOR-SEG 09
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Exercício (ano)</Label>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas as empresas (consolidado)</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Responsável (opcional)</Label>
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do responsável técnico / SESMT"
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                Prévia do período
              </div>
              {carregando ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando dados…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
                  <span>Acidentes típicos</span><span className="text-right font-semibold">{previa.total.absoluto}</span>
                  <span>Com afastamento</span><span className="text-right font-semibold">{previa.total.afastLeve + previa.total.afastGrave}</span>
                  <span>Óbitos</span><span className="text-right font-semibold">{previa.total.obitos}</span>
                  <span>Dias perdidos/debitados</span><span className="text-right font-semibold">{previa.total.diasPerdidos}</span>
                  <span>HHT lançado</span><span className="text-right font-semibold">{previa.total.hht.toLocaleString("pt-BR")} h</span>
                  <span>TF / TG</span>
                  <span className="text-right font-semibold">
                    {previa.total.tf.toFixed(2)} / {previa.total.tg.toFixed(2)}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground pt-1 leading-snug">
                Preenchimento automático a partir dos acidentes registrados e do HHT mensal. Acidentes de
                trajeto não entram no quadro (NBR 14280 / NR-04).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={gerar} disabled={gerando || carregando} className="gap-2">
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={!!doc}
        onClose={() => setDoc(null)}
        doc={doc}
        fileName={`FOR-SEG-09_Quadro-Estatistico_${ano}.pdf`}
        title={`Quadro Estatístico de Acidentes — FOR-SEG 09 · ${ano}`}
      />
    </>
  );
}

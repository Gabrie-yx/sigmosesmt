import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Stethoscope, FileDown, Building2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

const PDFPreviewDialog = lazy(() =>
  import("@/components/pdf-preview-dialog").then((m) => ({ default: m.PDFPreviewDialog })),
);

const EXAMES_COMUNS = [
  "Avaliação clínica ocupacional",
  "Audiometria tonal",
  "Espirometria",
  "Acuidade visual",
  "Hemograma completo",
  "Glicemia em jejum",
  "EAS / Sumário de urina",
  "ECG em repouso",
  "Raio-X de tórax",
  "Raio-X de coluna lombo-sacra",
  "Avaliação psicossocial (NR-33/35)",
];

type Props = {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  natureza?: "ADMISSIONAL" | "PERIODICO" | "RETORNO" | "MUDANCA" | "DEMISSIONAL";
};

export function GuiaEncaminhamentoDialog({ open, onClose, employeeId, natureza = "PERIODICO" }: Props) {
  const [prestadorId, setPrestadorId] = useState<string>("");
  const [exames, setExames] = useState<string[]>(["Avaliação clínica ocupacional"]);
  const [novoExame, setNovoExame] = useState("");
  const [solicitante, setSolicitante] = useState("Téc. Segurança SESMT");
  const [setor, setSetor] = useState("SESMT");
  const [obs, setObs] = useState("");
  const [naturezaSel, setNaturezaSel] = useState(natureza);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (open) {
      setPdfBlob(null);
      setPdfOpen(false);
    }
  }, [open]);

  const { data: emp } = useQuery({
    queryKey: ["guia-emp", employeeId],
    enabled: open && !!employeeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, cpf, rg, matricula, admissao, data_nascimento, sexo, setor, foto_url, assinatura_url, roles(name)")
        .eq("id", employeeId)
        .single();
      return data as any;
    },
  });

  const { data: prestadores } = useQuery({
    queryKey: ["guia-prestadores"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("prestadores_saude")
        .select("id, razao_social, nome_fantasia, cnpj, cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, horario_atendimento, especialidades")
        .eq("ativo", true)
        .order("razao_social");
      return data ?? [];
    },
  });

  const prestadorSel = useMemo(
    () => prestadores?.find((p: any) => p.id === prestadorId),
    [prestadorId, prestadores],
  );

  const toggleExame = (ex: string) => {
    setExames(prev => prev.includes(ex) ? prev.filter(x => x !== ex) : [...prev, ex]);
  };

  const addExame = () => {
    const t = novoExame.trim();
    if (!t) return;
    if (!exames.includes(t)) setExames([...exames, t]);
    setNovoExame("");
  };

  const gerar = async () => {
    if (!prestadorSel) { toast.error("Selecione o prestador de destino"); return; }
    if (!emp) { toast.error("Carregando dados do colaborador…"); return; }
    setGerando(true);
    try {
      const { gerarGuiaEncaminhamentoPDF } = await import("@/lib/guia-encaminhamento-pdf");
      const numero = `${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const blob = await gerarGuiaEncaminhamentoPDF({
        numero,
        data: new Date(),
        solicitante,
        setor,
        emp: {
          nome: emp.nome,
          cpf: emp.cpf, rg: emp.rg, matricula: emp.matricula,
          data_nascimento: emp.data_nascimento, sexo: emp.sexo,
          cargo: (emp.roles as any)?.name, setor: emp.setor,
          admissao: emp.admissao, foto_url: emp.foto_url, assinatura_url: emp.assinatura_url,
        },
        prestador: prestadorSel,
        exames,
        natureza: naturezaSel,
        observacoes: obs || undefined,
      });
      setPdfBlob(blob);
      setPdfOpen(true);
    } catch (e: any) {
      toast.error("Erro ao gerar guia: " + (e?.message ?? "desconhecido"));
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-3xl border-rose-300/15 bg-gradient-to-br from-[#1a0408]/95 via-rose-950/40 to-[#1a0408]/95 backdrop-blur-xl text-rose-50 max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-rose-50 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-rose-300" />
              Guia de Encaminhamento
            </DialogTitle>
            <DialogDescription className="text-rose-200/60 text-xs">
              {emp ? <>Para <b className="text-rose-100">{emp.nome}</b> · {(emp.roles as any)?.name ?? "—"}</> : "Carregando colaborador…"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 pr-3 -mr-3">
            <div className="space-y-4">
              {/* Prestador */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-rose-200/60 mb-1.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Prestador de destino
                </label>
                <Select value={prestadorId} onValueChange={setPrestadorId}>
                  <SelectTrigger className="bg-rose-100/5 border-rose-100/15 text-rose-50">
                    <SelectValue placeholder="Selecione a clínica…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a0408] border-rose-100/15 text-rose-50">
                    {(prestadores ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.razao_social}{p.cidade ? ` — ${p.cidade}/${p.uf}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {prestadorSel && (
                  <div className="mt-2 p-3 rounded-lg bg-rose-100/[0.04] border border-rose-100/10 text-[11px] space-y-0.5">
                    {prestadorSel.cnpj && <div className="text-rose-200/60">CNPJ {prestadorSel.cnpj}</div>}
                    <div className="text-rose-100/80 flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 text-rose-300/70 shrink-0" />
                      {[prestadorSel.logradouro, prestadorSel.numero, prestadorSel.bairro, prestadorSel.cidade && `${prestadorSel.cidade}/${prestadorSel.uf}`].filter(Boolean).join(", ")}
                    </div>
                    {prestadorSel.telefone && (
                      <div className="text-rose-100/80 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-rose-300/70" /> {prestadorSel.telefone}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Natureza */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-rose-200/60 mb-1.5 block">Natureza</label>
                  <Select value={naturezaSel} onValueChange={(v) => setNaturezaSel(v as any)}>
                    <SelectTrigger className="bg-rose-100/5 border-rose-100/15 text-rose-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a0408] border-rose-100/15 text-rose-50">
                      <SelectItem value="ADMISSIONAL">Admissional</SelectItem>
                      <SelectItem value="PERIODICO">Periódico</SelectItem>
                      <SelectItem value="RETORNO">Retorno ao trabalho</SelectItem>
                      <SelectItem value="MUDANCA">Mudança de função</SelectItem>
                      <SelectItem value="DEMISSIONAL">Demissional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-rose-200/60 mb-1.5 block">Solicitante</label>
                  <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className="bg-rose-100/5 border-rose-100/15 text-rose-50" />
                </div>
              </div>

              {/* Exames */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-rose-200/60 mb-1.5 block">Exames solicitados ({exames.length})</label>
                <div className="grid grid-cols-2 gap-1.5 p-3 rounded-lg bg-rose-100/[0.03] border border-rose-100/10">
                  {EXAMES_COMUNS.map(ex => (
                    <label key={ex} className="flex items-center gap-2 text-[12px] text-rose-50 cursor-pointer hover:bg-rose-100/5 px-1.5 py-1 rounded">
                      <Checkbox checked={exames.includes(ex)} onCheckedChange={() => toggleExame(ex)} className="border-rose-100/30" />
                      <span>{ex}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Outro exame…"
                    value={novoExame}
                    onChange={(e) => setNovoExame(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExame())}
                    className="bg-rose-100/5 border-rose-100/15 text-rose-50 h-8 text-xs"
                  />
                  <Button size="sm" type="button" onClick={addExame} className="bg-rose-600 hover:bg-rose-700 h-8">+ Add</Button>
                </div>
                {exames.filter(e => !EXAMES_COMUNS.includes(e)).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {exames.filter(e => !EXAMES_COMUNS.includes(e)).map(e => (
                      <Badge key={e} variant="outline" className="bg-rose-500/15 border-rose-400/30 text-rose-200 text-[10px] cursor-pointer" onClick={() => toggleExame(e)}>
                        {e} ✕
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-rose-200/60 mb-1.5 block">Observações</label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="bg-rose-100/5 border-rose-100/15 text-rose-50 text-xs" placeholder="Riscos específicos, condições, restrições…" />
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-3 border-t border-rose-100/10">
            <Button variant="outline" onClick={onClose} className="bg-transparent border-rose-100/20 text-rose-100 hover:bg-rose-100/5">Cancelar</Button>
            <Button onClick={gerar} disabled={gerando || !prestadorId} className="bg-rose-600 hover:bg-rose-700 text-white">
              <FileDown className="h-4 w-4 mr-1.5" />
              {gerando ? "Gerando…" : "Gerar Guia"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pdfBlob && (
        <Suspense fallback={null}>
          <PDFPreviewDialog
            open={pdfOpen}
            onOpenChange={setPdfOpen}
            pdfBlob={pdfBlob}
            title={`Guia · ${emp?.nome ?? ""}`}
            fileName={`guia-${emp?.nome?.split(" ")[0] ?? "func"}-${Date.now()}.pdf`}
          />
        </Suspense>
      )}
    </>
  );
}
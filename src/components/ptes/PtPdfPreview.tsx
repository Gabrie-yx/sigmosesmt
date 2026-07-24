import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, PenLine, Printer, X } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";
import { printPdf, renderPdfToImagePagesProgressive } from "@/lib/pdf-print";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { gerarPtePdf, type PtePdfParams } from "@/lib/pte-pdf";
import { fetchSignatureAsCleanDataUrl } from "@/lib/signature-utils";
import { AnexosSelector } from "@/components/pdf-anexos/anexos-selector";
import { mergeAnexos } from "@/lib/pdf-anexos-merge";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listarAnexosPorEscopo } from "@/lib/pdf-anexos.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  pt: any;
  apr?: any;
  casco?: any;
  company?: any;
  employees?: any[];
}

function isWeekend(date?: string | null) {
  if (!date) return null;
  const d = new Date(`${date.split("T")[0]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay() === 0 || d.getDay() === 6;
}

export function PtPdfPreview({ open, onClose, pt, apr, casco, company, employees = [] }: Props) {
  const [assinaturaTst, setAssinaturaTst] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState<null | "tst" | "encarregado" | "gerente">(null);
  const [assinaturaEnc, setAssinaturaEnc] = useState<string | null>(null);
  const [assinaturaGer, setAssinaturaGer] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [empSigs, setEmpSigs] = useState<Record<string, string | null>>({});
  const [anexosSel, setAnexosSel] = useState<string[]>([]);
  const tokenRef = useRef(0);

  const listarAnexos = useServerFn(listarAnexosPorEscopo);
  const { data: anexosDisponiveis = [] } = useQuery({
    queryKey: ["pdf-anexos-padrao", "pte"],
    queryFn: () => listarAnexos({ data: { escopo: "pte" } }),
    enabled: open,
    staleTime: 60_000,
  });

  const params = useMemo<PtePdfParams | null>(() => {
    if (!pt) return null;
    const employeeMap = new Map((employees ?? []).map((e: any) => [e.id, e]));
    const byName = new Map((employees ?? []).map((e: any) => [String(e.nome ?? "").trim(), e]));
    const employeeName = (id?: string | null) => (id ? employeeMap.get(id)?.nome : "");
    const dados = (pt.dados ?? {}) as any;
    const atv = (dados.atividades ?? {}) as any;
    const encarregado = (dados.encarregado_nome && String(dados.encarregado_nome).trim())
      || employeeName(pt.requisitante_id)
      || pt.employee_name
      || "";
    const equipeLista = Array.isArray(dados.equipe_lista) ? dados.equipe_lista : [];
    const sigOf = (nome?: string) => {
      if (!nome) return null;
      const emp = byName.get(String(nome).trim());
      const url = emp?.assinatura_url as string | undefined;
      return url ? (empSigs[url] ?? null) : null;
    };
    const localTexto = [pt.local, casco ? `CASCO ${casco.numero}${casco.nome ? ` — ${casco.nome}` : ""}` : null]
      .filter(Boolean).join(" · ");
    return {
      numero: pt.numero,
      data_inicio: formatDateBR(pt.data_emissao || pt.data),
      hora_inicio: pt.hora_inicio ?? "",
      data_fim: formatDateBR(pt.validade_ate || pt.data_emissao || pt.data),
      hora_fim: pt.hora_fim ?? "",
      empresa: company?.name ?? "",
      encarregado,
      local_descricao: localTexto,
      tipo_pt: pt.tipo_pt,
      mao_obra: (dados.mao_obra ?? null) as any,
      fim_de_semana: isWeekend(pt.data_emissao || pt.data),
      area_restrita: typeof dados.area_restrita === "boolean" ? dados.area_restrita : null,
      atividades: {
        movimentacao_cargas: !!atv.movimentacao_cargas,
        manutencao_civil: !!atv.manutencao_civil,
        gases_inflamaveis: !!atv.gases_inflamaveis,
        altura_telhados: !!atv.altura_telhados,
        demolicao_escavacao: !!atv.demolicao_escavacao,
        eletricidade: !!atv.eletricidade,
        trabalho_quente: !!atv.trabalho_quente,
        local_confinado: !!atv.local_confinado,
        outros: !!atv.outros,
      },
      outros_atividade_texto: dados.outros_atividade_texto ?? "",
      riscos_potenciais: dados.riscos_potenciais ?? {},
      outros_risco_texto: dados.outros_risco_texto ?? "",
      preenchimento_snna: dados.preenchimento_snna ?? {},
      outros_snna_texto: dados.outros_snna_texto ?? "",
      precaucao_quente: dados.precaucao_quente ?? {},
      teste_atmosfera_horario: dados.teste_atmosfera_horario ?? "",
      teste_atmosfera_percentual: dados.teste_atmosfera_percentual ?? "",
      designado_liberacao: dados.designado_liberacao ?? "",
      precaucao_altura: dados.precaucao_altura ?? {},
      precaucao_eletrica: dados.precaucao_eletrica ?? {},
      responsavel_bloqueio: dados.responsavel_bloqueio ?? "",
      precaucao_carga: dados.precaucao_carga ?? {},
      precaucao_pintura: dados.precaucao_pintura ?? {},
      epis_col1: dados.epis_col1 ?? {},
      epis_col2: dados.epis_col2 ?? {},
      outros_epi: dados.outros_epi ?? {},
      recomendacoes_adicionais: dados.recomendacoes_adicionais ?? "",
      equipe_lista: equipeLista,
      equipe_assinaturas_data_urls: equipeLista.map((r: any) => sigOf(r?.nome)),
      assinatura_encarregado_nome: dados.assinatura_encarregado_nome ?? "",
      assinatura_gerente_nome: dados.assinatura_gerente_nome ?? "",
      assinatura_tst_data_url: assinaturaTst,
      assinatura_encarregado_data_url: assinaturaEnc ?? sigOf(dados.assinatura_encarregado_nome),
      assinatura_gerente_data_url: assinaturaGer ?? sigOf(dados.assinatura_gerente_nome),
    };
  }, [pt, apr, casco, company, employees, assinaturaTst, assinaturaEnc, assinaturaGer, empSigs]);

  // Pré-carrega assinaturas oficiais dos employees envolvidos (galeria/ficha)
  useEffect(() => {
    if (!open || !pt) return;
    const dados = (pt.dados ?? {}) as any;
    const nomes = new Set<string>();
    for (const r of (dados.equipe_lista ?? [])) if (r?.nome) nomes.add(String(r.nome).trim());
    if (dados.assinatura_encarregado_nome) nomes.add(String(dados.assinatura_encarregado_nome).trim());
    if (dados.assinatura_gerente_nome) nomes.add(String(dados.assinatura_gerente_nome).trim());
    const byName = new Map((employees ?? []).map((e: any) => [String(e.nome ?? "").trim(), e]));
    const urls = Array.from(nomes)
      .map((n) => byName.get(n)?.assinatura_url as string | undefined)
      .filter((u): u is string => !!u && !(u in empSigs));
    if (urls.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(urls.map(async (u) => [u, await fetchSignatureAsCleanDataUrl(u)] as const));
      if (cancelled) return;
      setEmpSigs((prev) => {
        const next = { ...prev };
        for (const [u, d] of entries) next[u] = d;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [open, pt, employees, empSigs]);

  useEffect(() => {
    if (!open || !params) return;
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    setPages([]);
    setBlob(null);
    (async () => {
      try {
        const b = await gerarPtePdf(params);
        if (tokenRef.current !== token) return;
        const escolhidos = anexosDisponiveis
          .filter((a) => anexosSel.includes(a.id))
          .map((a) => ({ id: a.id, arquivo_path: a.arquivo_path, titulo: a.titulo }));
        let finalBlob = b;
        if (escolhidos.length > 0) {
          const merged = await mergeAnexos(await b.arrayBuffer(), escolhidos);
          if (tokenRef.current !== token) return;
          finalBlob = new Blob([merged as BlobPart], { type: "application/pdf" });
        }
        setBlob(finalBlob);
        const buf = await finalBlob.arrayBuffer();
        await renderPdfToImagePagesProgressive(buf, (page) => {
          if (tokenRef.current !== token) return;
          setPages((prev) => [...prev, page]);
        }, 2);
      } catch (e: any) {
        if (tokenRef.current === token) setError(e?.message ?? "Falha ao gerar PDF");
      } finally {
        if (tokenRef.current === token) setLoading(false);
      }
    })();
    return () => { tokenRef.current++; };
  }, [open, params, anexosSel, anexosDisponiveis]);

  if (!pt) return null;

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${pt.numero || "PTE"}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = async () => {
    if (!blob) return;
    await printPdf(blob, `${pt.numero || "PTE"}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0 bg-popover text-popover-foreground border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>Permissão de Trabalho Especial — {pt.numero}</DialogTitle>
            <DialogDescription>Overlay sobre o PDF homologado FOR-SEG-04.</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-card">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-foreground">FOR-SEG-04 — {pt.numero}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PDF homologado preenchido com dados da PT</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPadOpen("encarregado")} size="sm" variant="outline">
                <PenLine className="h-4 w-4 mr-1" /> {assinaturaEnc ? "Refazer Encarregado" : "Assinar Encarregado"}
              </Button>
              <Button onClick={() => setPadOpen("gerente")} size="sm" variant="outline">
                <PenLine className="h-4 w-4 mr-1" /> {assinaturaGer ? "Refazer Gerente" : "Assinar Gerente"}
              </Button>
              <Button onClick={() => setPadOpen("tst")} size="sm" variant="outline">
                <PenLine className="h-4 w-4 mr-1" /> {assinaturaTst ? "Refazer assinatura" : "Assinar (TST)"}
              </Button>
              <Button onClick={handleDownload} size="sm" variant="outline" disabled={loading || !blob}>
                <Download className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
              <Button onClick={handlePrint} size="sm" disabled={loading || !blob}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
              <Button onClick={onClose} size="sm" variant="outline" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(95vh-65px)] overflow-auto bg-muted p-4">
            {anexosDisponiveis.length > 0 && (
              <div className="mb-4 rounded-lg border border-border bg-card p-3 max-w-[860px] mx-auto">
                <AnexosSelector escopo="pte" value={anexosSel} onChange={setAnexosSel} />
              </div>
            )}
            {error ? (
              <div className="text-sm text-destructive p-6 text-center">Não foi possível gerar o PDF: {error}</div>
            ) : pages.length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center">
                {loading ? "Aplicando dados no PDF homologado…" : "Aguardando…"}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {pages.map((p, i) => (
                  <img key={i} src={p} alt={`Página ${i + 1}`} className="w-full max-w-[860px] bg-white shadow-md border border-border" />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <SignaturePadDialog
        open={!!padOpen}
        onClose={() => setPadOpen(null)}
        onConfirm={(r) => {
          if (padOpen === "tst") setAssinaturaTst(r.dataUrl);
          else if (padOpen === "encarregado") setAssinaturaEnc(r.dataUrl);
          else if (padOpen === "gerente") setAssinaturaGer(r.dataUrl);
          setPadOpen(null);
        }}
        title={padOpen === "encarregado" ? "Assinatura do Encarregado" : padOpen === "gerente" ? "Assinatura do Gerente" : "Assinatura do TST"}
      />
    </>
  );
}

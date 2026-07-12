import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, PenLine, Printer, X } from "lucide-react";
import { PT_TIPOS } from "@/lib/constants";
import { formatDateBR } from "@/lib/utils-date";
import { printHtmlContent } from "@/lib/pdf-print";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  pt: any;
  apr?: any;
  casco?: any;
  company?: any;
  employees?: any[];
}

const EMPTY = "\u00a0";

const pteDocumentCss = `
  .pte-document-root { background: #e7e5e4; color: #111827; font-family: Arial, Helvetica, sans-serif; }
  .pte-sheet { width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 7mm; background: #fff; box-shadow: 0 18px 45px rgba(0,0,0,.18); box-sizing: border-box; }
  .pte-sheet * { box-sizing: border-box; }
  .pte-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .pte-table td, .pte-table th { border: 1px solid #111827; padding: 2.2mm 2.4mm; vertical-align: middle; font-size: 8.2pt; line-height: 1.18; color: #111827; }
  .pte-table th { font-weight: 700; text-transform: uppercase; background: #f3f4f6; }
  .pte-title { font-size: 12.8pt; font-weight: 800; text-align: center; letter-spacing: .02em; }
  .pte-subtitle { font-size: 7.2pt; text-align: center; font-weight: 700; text-transform: uppercase; }
  .pte-logo { font-size: 14pt; font-weight: 900; text-align: center; letter-spacing: .08em; }
  .pte-label { display: block; margin-bottom: 1.2mm; font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #374151; }
  .pte-value { display: block; min-height: 11pt; font-size: 8.4pt; font-weight: 700; text-transform: uppercase; overflow-wrap: anywhere; }
  .pte-value.normal { text-transform: none; font-weight: 600; }
  .pte-small { font-size: 6.8pt; line-height: 1.12; }
  .pte-section { margin-top: 2.5mm; }
  .pte-section-title { padding: 1.6mm 2.2mm; border: 1px solid #111827; border-bottom: 0; background: #e5e7eb; font-size: 7.4pt; font-weight: 900; text-transform: uppercase; letter-spacing: .03em; }
  .pte-check-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.1mm 3mm; }
  .pte-check { display: inline-flex; align-items: center; gap: 1.4mm; min-height: 12pt; font-size: 7.4pt; font-weight: 700; text-transform: uppercase; }
  .pte-box { width: 11pt; height: 11pt; border: 1.3px solid #111827; display: inline-flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 900; line-height: 1; flex: 0 0 auto; }
  .pte-line { min-height: 18pt; border-bottom: 1px solid #111827; padding-top: 2mm; font-size: 8pt; font-weight: 700; overflow-wrap: anywhere; }
  .pte-signature-cell { height: 24mm; vertical-align: bottom !important; text-align: center; }
  .pte-signature-img { max-width: 46mm; max-height: 14mm; display: block; margin: 0 auto 1mm; object-fit: contain; }
  .pte-signature-line { border-top: 1px solid #111827; padding-top: 1mm; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; }
  .pte-muted { color: #4b5563; font-weight: 600; }
  .pte-page-break { break-before: page; page-break-before: always; }
  @media print {
    .pte-document-root { background: #fff !important; }
    .pte-sheet { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
    .pte-sheet:last-child { break-after: auto; page-break-after: auto; }
  }
`;

const printCss = `
  @page { size: A4; margin: 0; }
  .sigmo-print-html-root { width: 210mm !important; padding: 0 !important; }
  .pte-document-root { background: #fff !important; }
  .pte-sheet { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .pte-sheet:last-child { break-after: auto; page-break-after: auto; }
`;

function mark(checked: boolean) {
  return checked ? "X" : "";
}

function valueOrBlank(value: unknown) {
  const text = value == null ? "" : String(value).trim();
  return text || EMPTY;
}

function isWeekend(date?: string | null) {
  if (!date) return null;
  const d = new Date(`${date.split("T")[0]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay() === 0 || d.getDay() === 6;
}

function includesAny(source: string, terms: string[]) {
  const normalized = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function PtPdfPreview({ open, onClose, pt, apr, casco, company, employees = [] }: Props) {
  const [assinaturaTst, setAssinaturaTst] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const vm = useMemo(() => {
    if (!pt) return null;
    const tipoInfo = PT_TIPOS.find((t) => t.value === pt.tipo_pt) ?? PT_TIPOS[0];
    const employeeMap = new Map((employees ?? []).map((e: any) => [e.id, e]));
    const employeeName = (id?: string | null) => id ? employeeMap.get(id)?.nome : "";
    const requisitante = employeeName(pt.requisitante_id) || pt.employee_name || "";
    const executantes = ((pt.executantes_ids as string[] | null) ?? [])
      .map((id) => employeeName(id))
      .filter(Boolean);
    if (!executantes.length && pt.employee_name) executantes.push(pt.employee_name);
    const sourceText = [pt.tipo_pt, pt.risco, pt.local, apr?.atividade_descricao].filter(Boolean).join(" ");
    const fds = isWeekend(pt.data_emissao || pt.data);
    const flags = {
      movimentacao_cargas: pt.tipo_pt === "PTI" || includesAny(sourceText, ["icamento", "movimentacao", "carga", "guindaste"]),
      manutencao_civil: includesAny(sourceText, ["manutencao civil", "civil", "alvenaria", "concreto"]),
      gases_inflamaveis: includesAny(sourceText, ["gas", "gases", "inflamavel", "inflamaveis"]),
      altura_telhados: pt.tipo_pt === "PTA" || includesAny(sourceText, ["altura", "telhado", "andaime"]),
      demolicao_escavacao: includesAny(sourceText, ["demolicao", "escavacao", "vala"]),
      eletricidade: pt.tipo_pt === "PTEL" || includesAny(sourceText, ["eletric", "loto", "alta tensao"]),
      trabalho_quente: pt.tipo_pt === "PTQ" || includesAny(sourceText, ["quente", "solda", "corte", "esmerilh"]),
      local_confinado: pt.tipo_pt === "PET" || includesAny(sourceText, ["confinado", "tanque"]),
    };
    const temAtividadeMarcada = Object.values(flags).some(Boolean);
    return {
      tipoInfo,
      numero: pt.numero,
      dataInicio: formatDateBR(pt.data_emissao || pt.data),
      horaInicio: pt.hora_inicio ?? "",
      dataFim: formatDateBR(pt.validade_ate || pt.data_emissao || pt.data),
      horaFim: pt.hora_fim ?? "",
      validade: pt.validade_tipo === "24H" ? "24 horas" : pt.validade_tipo === "CUSTOM" ? formatDateBR(pt.validade_ate) : "Turno / expediente",
      empresa: company?.name ?? "",
      encarregado: pt.encarregado_nome ?? requisitante,
      requisitante,
      executantes,
      vigia: employeeName(pt.vigia_id),
      supervisor: employeeName(pt.supervisor_entrada_id),
      local: pt.local ?? "",
      casco: casco ? `CASCO ${casco.numero}${casco.nome ? ` — ${casco.nome}` : ""}` : "",
      risco: pt.risco ?? "",
      apr: apr ? `APR ${apr.numero} — ${apr.atividade_descricao ?? ""}` : pt.emergencia_sem_apr ? `EMERGÊNCIA SEM APR — ${pt.emergencia_justificativa ?? ""}` : "",
      flags: { ...flags, outros: !temAtividadeMarcada || pt.tipo_pt === "PTE" || pt.tipo_pt === "PTS" || pt.tipo_pt === "PTP" },
      fds,
      areaRestrita: pt.area_restrita as boolean | null | undefined,
      maoObra: pt.mao_obra as string | null | undefined,
      plano: (pt.plano_resgate ?? {}) as any,
    };
  }, [pt, apr, casco, company, employees]);

  if (!pt || !vm) return null;

  const handlePrint = async () => {
    const node = docRef.current;
    if (!node) return window.print();
    await printHtmlContent(node.innerHTML, pt.numero || "PTE", printCss);
  };

  const handleDownload = async () => {
    const node = docRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: 0,
          filename: `${pt.numero || "PTE"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], before: ".pte-page-break" },
        } as any)
        .from(node)
        .save();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0 bg-popover text-popover-foreground border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>Permissão de Trabalho Especial — {pt.numero}</DialogTitle>
            <DialogDescription>Visualização fiel em formulário para impressão e PDF.</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-card">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-foreground">FOR-SEG-04 — {pt.numero}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Formulário PTE em campos fixos</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPadOpen(true)} size="sm" variant="outline">
                <PenLine className="h-4 w-4 mr-1" /> {assinaturaTst ? "Refazer assinatura" : "Assinar (TST)"}
              </Button>
              <Button onClick={handleDownload} size="sm" variant="outline" disabled={downloading}>
                <Download className="h-4 w-4 mr-1" /> {downloading ? "Gerando…" : "Baixar PDF"}
              </Button>
              <Button onClick={handlePrint} size="sm">
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
              <Button onClick={onClose} size="sm" variant="outline" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(95vh-65px)] overflow-auto bg-muted p-4">
            <div ref={docRef} className="pte-document-root">
              <style>{pteDocumentCss}</style>
              <section className="pte-sheet">
                <table className="pte-table">
                  <tbody>
                    <tr>
                      <td style={{ width: "24%" }}><div className="pte-logo">SIGMO</div><div className="pte-subtitle">Segurança do Trabalho</div></td>
                      <td style={{ width: "52%" }}><div className="pte-title">PERMISSÃO DE TRABALHO ESPECIAL</div><div className="pte-subtitle">{vm.tipoInfo.label} • {vm.tipoInfo.nr}</div></td>
                      <td style={{ width: "24%" }}><span className="pte-label">Código</span><span className="pte-value">FOR-SEG-04</span><span className="pte-label" style={{ marginTop: "2mm" }}>Nº da PT</span><span className="pte-value">{valueOrBlank(vm.numero)}</span></td>
                    </tr>
                  </tbody>
                </table>

                <div className="pte-section">
                  <div className="pte-section-title">1. Identificação e validade da permissão</div>
                  <table className="pte-table">
                    <tbody>
                      <tr>
                        <td><span className="pte-label">Data início</span><span className="pte-value">{valueOrBlank(vm.dataInicio)}</span></td>
                        <td><span className="pte-label">Hora início</span><span className="pte-value">{valueOrBlank(vm.horaInicio)}</span></td>
                        <td><span className="pte-label">Data fim</span><span className="pte-value">{valueOrBlank(vm.dataFim)}</span></td>
                        <td><span className="pte-label">Hora fim</span><span className="pte-value">{valueOrBlank(vm.horaFim)}</span></td>
                        <td><span className="pte-label">Validade</span><span className="pte-value">{valueOrBlank(vm.validade)}</span></td>
                      </tr>
                      <tr>
                        <td colSpan={2}><span className="pte-label">Empresa executante</span><span className="pte-value">{valueOrBlank(vm.empresa)}</span></td>
                        <td colSpan={2}><span className="pte-label">Encarregado / requisitante</span><span className="pte-value">{valueOrBlank(vm.encarregado)}</span></td>
                        <td><span className="pte-label">Classificação</span><span className="pte-value">{valueOrBlank(pt.tipo_pt)}</span></td>
                      </tr>
                      <tr>
                        <td colSpan={3}><span className="pte-label">Local / instalação</span><span className="pte-value">{valueOrBlank(vm.local)}</span></td>
                        <td colSpan={2}><span className="pte-label">Frente / casco</span><span className="pte-value">{valueOrBlank(vm.casco)}</span></td>
                      </tr>
                      <tr>
                        <td colSpan={5}><span className="pte-label">APR vinculada / justificativa</span><span className="pte-value normal">{valueOrBlank(vm.apr)}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">2. Descrição das atividades a serem executadas</div>
                  <table className="pte-table">
                    <tbody>
                      <tr>
                        <td>
                          <div className="pte-check-grid">
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.movimentacao_cargas)}</span> Movimentação de cargas</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.manutencao_civil)}</span> Manutenção civil</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.gases_inflamaveis)}</span> Gases inflamáveis</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.altura_telhados)}</span> Altura / telhados</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.demolicao_escavacao)}</span> Demolição / escavação</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.eletricidade)}</span> Eletricidade</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.trabalho_quente)}</span> Trabalho a quente</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.local_confinado)}</span> Local confinado</span>
                            <span className="pte-check"><span className="pte-box">{mark(vm.flags.outros)}</span> Outros</span>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td><span className="pte-label">Descrição / risco principal</span><div className="pte-line">{valueOrBlank(vm.risco)}</div></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">3. Caracterização do serviço</div>
                  <table className="pte-table">
                    <tbody>
                      <tr>
                        <td style={{ width: "33%" }}>
                          <span className="pte-label">Mão de obra</span>
                          <span className="pte-check"><span className="pte-box">{mark(vm.maoObra === "INTERNA")}</span> Interna</span>
                          <span className="pte-check" style={{ marginLeft: "5mm" }}><span className="pte-box">{mark(vm.maoObra === "EXTERNA")}</span> Externa</span>
                        </td>
                        <td style={{ width: "33%" }}>
                          <span className="pte-label">Fim de semana / feriado</span>
                          <span className="pte-check"><span className="pte-box">{mark(vm.fds === true)}</span> Sim</span>
                          <span className="pte-check" style={{ marginLeft: "5mm" }}><span className="pte-box">{mark(vm.fds === false)}</span> Não</span>
                        </td>
                        <td style={{ width: "34%" }}>
                          <span className="pte-label">Área restrita</span>
                          <span className="pte-check"><span className="pte-box">{mark(vm.areaRestrita === true)}</span> Sim</span>
                          <span className="pte-check" style={{ marginLeft: "5mm" }}><span className="pte-box">{mark(vm.areaRestrita === false)}</span> Não</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">4. Equipe autorizada</div>
                  <table className="pte-table">
                    <tbody>
                      <tr>
                        <td style={{ width: "50%" }}><span className="pte-label">Requisitante / líder do serviço</span><span className="pte-value">{valueOrBlank(vm.requisitante)}</span></td>
                        <td><span className="pte-label">Executantes</span><span className="pte-value normal">{valueOrBlank(vm.executantes.join(", "))}</span></td>
                      </tr>
                      {(pt.tipo_pt === "PET" || vm.vigia || vm.supervisor) && (
                        <tr>
                          <td><span className="pte-label">Vigia NR-33</span><span className="pte-value">{valueOrBlank(vm.vigia)}</span></td>
                          <td><span className="pte-label">Supervisor de entrada NR-33</span><span className="pte-value">{valueOrBlank(vm.supervisor)}</span></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">5. Verificações mínimas antes da liberação</div>
                  <table className="pte-table">
                    <thead>
                      <tr><th>Item de controle</th><th style={{ width: "14mm" }}>Sim</th><th style={{ width: "14mm" }}>Não</th><th style={{ width: "14mm" }}>N/A</th></tr>
                    </thead>
                    <tbody>
                      {[
                        "APR analisada e entendida pela equipe executante",
                        "Isolamento e sinalização da área executados",
                        "EPI/EPC compatíveis com o risco da atividade",
                        "Ferramentas e equipamentos inspecionados",
                        "Fontes de energia bloqueadas quando aplicável",
                        "Condições climáticas/ambiente avaliadas",
                        "Comunicação de emergência definida",
                      ].map((item) => (
                        <tr key={item}>
                          <td>{item}</td><td style={{ textAlign: "center" }}><span className="pte-box" /></td><td style={{ textAlign: "center" }}><span className="pte-box" /></td><td style={{ textAlign: "center" }}><span className="pte-box" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">6. Observações / restrições adicionais</div>
                  <table className="pte-table"><tbody><tr><td style={{ height: "23mm" }}><span className="pte-value normal">{valueOrBlank(pt.observacoes)}</span></td></tr></tbody></table>
                </div>
              </section>

              <section className="pte-sheet pte-page-break">
                <table className="pte-table">
                  <tbody>
                    <tr>
                      <td style={{ width: "24%" }}><div className="pte-logo">SIGMO</div></td>
                      <td><div className="pte-title">PERMISSÃO DE TRABALHO ESPECIAL</div><div className="pte-subtitle">Continuação — autorizações e encerramento</div></td>
                      <td style={{ width: "24%" }}><span className="pte-label">Nº da PT</span><span className="pte-value">{valueOrBlank(vm.numero)}</span></td>
                    </tr>
                  </tbody>
                </table>

                {pt.tipo_pt === "PET" && (
                  <div className="pte-section">
                    <div className="pte-section-title">7. Plano de resgate — NR-33</div>
                    <table className="pte-table">
                      <tbody>
                        <tr><td><span className="pte-label">Equipe de resgate</span><span className="pte-value normal">{valueOrBlank(vm.plano.equipe_resgate)}</span></td></tr>
                        <tr><td><span className="pte-label">Equipamentos de resgate</span><span className="pte-value normal">{valueOrBlank(vm.plano.equipamentos)}</span></td></tr>
                        <tr><td><span className="pte-label">Hospital de referência</span><span className="pte-value normal">{valueOrBlank(vm.plano.hospital_referencia)}</span></td></tr>
                        <tr>
                          <td><span className="pte-label">Tempo de resposta / comunicação</span><span className="pte-value normal">{valueOrBlank([vm.plano.tempo_resposta_min ? `${vm.plano.tempo_resposta_min} min` : "", vm.plano.meio_comunicacao].filter(Boolean).join(" — "))}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="pte-section">
                  <div className="pte-section-title">7. Ciência da equipe executante</div>
                  <table className="pte-table">
                    <thead><tr><th style={{ width: "10mm" }}>Nº</th><th>Nome</th><th style={{ width: "34mm" }}>Matrícula</th><th style={{ width: "52mm" }}>Assinatura</th></tr></thead>
                    <tbody>
                      {Array.from({ length: Math.max(6, vm.executantes.length) }).map((_, index) => {
                        const name = vm.executantes[index] ?? "";
                        const emp = employees.find((e: any) => e.nome === name);
                        return <tr key={index}><td style={{ textAlign: "center" }}>{index + 1}</td><td>{valueOrBlank(name)}</td><td>{valueOrBlank(emp?.matricula)}</td><td style={{ height: "10mm" }}>{EMPTY}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">8. Autorizações</div>
                  <table className="pte-table">
                    <tbody>
                      <tr>
                        <td className="pte-signature-cell">
                          <div className="pte-signature-line">Requisitante / encarregado</div>
                          <div className="pte-muted pte-small">{valueOrBlank(vm.requisitante)}</div>
                        </td>
                        <td className="pte-signature-cell">
                          {assinaturaTst && <img src={assinaturaTst} alt="Assinatura TST" className="pte-signature-img" />}
                          <div className="pte-signature-line">Segurança do Trabalho</div>
                          <div className="pte-muted pte-small">TST responsável</div>
                        </td>
                        <td className="pte-signature-cell">
                          <div className="pte-signature-line">Responsável da área</div>
                          <div className="pte-muted pte-small">Nome / matrícula</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pte-section">
                  <div className="pte-section-title">9. Encerramento da permissão</div>
                  <table className="pte-table">
                    <tbody>
                      <tr>
                        <td style={{ width: "34%" }}><span className="pte-label">Data</span><div className="pte-line">{EMPTY}</div></td>
                        <td style={{ width: "33%" }}><span className="pte-label">Hora</span><div className="pte-line">{EMPTY}</div></td>
                        <td><span className="pte-label">Status no sistema</span><span className="pte-value">{valueOrBlank(pt.status)}</span></td>
                      </tr>
                      <tr><td colSpan={3} style={{ height: "24mm" }}><span className="pte-label">Observações do encerramento</span>{EMPTY}</td></tr>
                      <tr>
                        <td className="pte-signature-cell"><div className="pte-signature-line">Encarregado</div></td>
                        <td className="pte-signature-cell"><div className="pte-signature-line">Segurança do Trabalho</div></td>
                        <td className="pte-signature-cell"><div className="pte-signature-line">Responsável da área</div></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SignaturePadDialog
        open={padOpen}
        onClose={() => setPadOpen(false)}
        onConfirm={(r) => { setAssinaturaTst(r.dataUrl); setPadOpen(false); }}
        title="Assinatura do Técnico de Segurança do Trabalho"
      />
    </>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { Search, MessageCircle, FileDown, AlertTriangle, Clock, CalendarCheck, Stethoscope, Building2, Copy, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";
import { drawPdfHeader } from "@/lib/pdf-header";
import { EMPRESA_INFO } from "@/lib/empresa-info";
import { toast } from "sonner";

/**
 * Convocação Inteligente de Exames (Modal-First)
 * Substitui o "294" do SOC — listagem morta — por uma tela acionável:
 * semáforo + filtro por janela (30/60/90) + ações (WhatsApp / Ofício PDF).
 * Periodicidade default = 12 meses (ASO periódico padrão NR-7).
 */

const PERIODICIDADE_MESES = 12;

type Janela = "VENCIDOS" | "30" | "60" | "90" | "TODOS";

function addMonths(date: Date, m: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}
function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}
function statusOf(dias: number | null): { tone: string; label: string; bg: string } {
  if (dias === null) return { tone: "text-slate-300", label: "Sem ASO", bg: "bg-slate-500/15 border-slate-400/30" };
  if (dias < 0) return { tone: "text-rose-300", label: `Vencido há ${Math.abs(dias)}d`, bg: "bg-rose-500/15 border-rose-400/40" };
  if (dias <= 30) return { tone: "text-amber-300", label: `Vence em ${dias}d`, bg: "bg-amber-500/15 border-amber-400/40" };
  if (dias <= 60) return { tone: "text-yellow-200", label: `Vence em ${dias}d`, bg: "bg-yellow-500/10 border-yellow-300/30" };
  if (dias <= 90) return { tone: "text-emerald-200", label: `Vence em ${dias}d`, bg: "bg-emerald-500/10 border-emerald-400/30" };
  return { tone: "text-emerald-300", label: "Em dia", bg: "bg-emerald-500/10 border-emerald-400/30" };
}

function normalizeWhatsappPhone(emp: any) {
  const fone = (emp.whatsapp ?? "").replace(/\D/g, "");
  if (!fone) return "";
  return fone.startsWith("55") ? fone : `55${fone}`;
}

function buildWhatsappMessage(emp: any, proximoStr: string) {
  const nome = (emp.nome ?? "").split(" ")[0];
  const situacao = proximoStr && proximoStr !== "—"
    ? `vence em *${proximoStr}*`
    : "está pendente de regularização no SIGMO";
  return (
    `Olá, ${nome}! 👋\n\n` +
    `Aqui é da Segurança do Trabalho da DMN. Seu *Atestado de Saúde Ocupacional (ASO)* ${situacao}.\n\n` +
    `Precisamos agendar seu exame periódico. Pode confirmar um horário esta semana?\n\n` +
    `Obrigado! 🙏`
  );
}

function buildWhatsappLinks(phone: string, message: string) {
  const text = encodeURIComponent(message);
  return {
    app: `https://wa.me/${phone}?text=${text}`,
    web: `https://web.whatsapp.com/send?phone=${phone}&text=${text}`,
  };
}

type OficioCtx = {
  solicitante: string;
  setor: string;
  destino: string;
  horario: string;
  tipoExame: string;
  numeroOficio: string;
};

function criarOficioPDF(
  emp: any,
  asoData: Date | null,
  proximo: Date | null,
  cargo: string,
  empresa: string,
  ctx: OficioCtx,
) {
  const hojeDate = new Date();
  const hoje = hojeDate.toLocaleDateString("pt-BR");
  const proxStr = proximo ? proximo.toLocaleDateString("pt-BR") : "—";
  const asoStr = asoData ? asoData.toLocaleDateString("pt-BR") : "—";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const MARGIN = 18;
  const maxW = W - MARGIN * 2;

  // Cabeçalho institucional padrão (logo DMN + CNPJ + endereço)
  let y = drawPdfHeader(doc, {
    titulo: "Ofício de convocação — Exame Médico Ocupacional",
    subtitulo: "SESMT · NR-7 / PCMSO",
    responsavel: ctx.solicitante || "SESMT — Segurança e Saúde no Trabalho",
  });
  y += 2;

  // Cabeçalho do ofício (nº + cidade/data)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`OFÍCIO Nº ${ctx.numeroOficio}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Manaus/AM, ${hoje}`, W - MARGIN, y, { align: "right" });
  y += 7;

  // Box "DADOS DA SOLICITAÇÃO"
  const boxH = 26;
  doc.setDrawColor(100, 116, 139);
  doc.setFillColor(241, 245, 249);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, maxW, boxH, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("DADOS DA SOLICITAÇÃO", MARGIN + 3, y + 4.5);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const col1X = MARGIN + 3;
  const col2X = MARGIN + maxW / 2 + 2;
  const drawKV = (k: string, v: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, x, yy);
    doc.setFont("helvetica", "normal");
    const kw = doc.getTextWidth(k) + 1.5;
    doc.text(v || "—", x + kw, yy);
  };
  drawKV("Solicitante:", ctx.solicitante, col1X, y + 11);
  drawKV("Setor:", ctx.setor, col1X, y + 17);
  drawKV("Tipo de exame:", ctx.tipoExame, col1X, y + 23);
  drawKV("Local:", ctx.destino, col2X, y + 11);
  drawKV("Horário:", ctx.horario, col2X, y + 17);
  drawKV("Data emissão:", hoje, col2X, y + 23);
  y += boxH + 6;

  // Destinatário
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("AO(À) COLABORADOR(A):", MARGIN, y);
  y += 5.5;
  doc.setFontSize(11);
  doc.text((emp.nome ?? "—").toUpperCase(), MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const dest: string[] = [];
  if (emp.matricula) dest.push(`Matrícula ${emp.matricula}`);
  if (cargo) dest.push(`Cargo: ${cargo}`);
  if (empresa) dest.push(`Lotação: ${empresa}`);
  if (dest.length) {
    doc.setTextColor(30, 41, 59);
    doc.text(dest.join("   ·   "), MARGIN, y);
    y += 5;
  }
  doc.setTextColor(15, 23, 42);
  y += 3;

  // Assunto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Assunto: Convocação para ${ctx.tipoExame || "Exame Médico Ocupacional"} (ASO).`,
    MARGIN,
    y,
  );
  y += 7;

  // Corpo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const paragrafos = [
    "Prezado(a) Colaborador(a),",
    `Em cumprimento à Norma Regulamentadora nº 7 (NR-7) do Ministério do Trabalho e Emprego, que dispõe sobre o Programa de Controle Médico de Saúde Ocupacional (PCMSO), e em conformidade com o Sistema de Gestão Integrado de SST (SGI-SST) da ${EMPRESA_INFO.razao_social}, fica V.S.ª CONVOCADO(A) a comparecer para realização de ${ctx.tipoExame || "Exame Médico Ocupacional"}.`,
    `Último ASO realizado em ${asoStr}. Vencimento previsto em ${proxStr}.`,
    `Local de comparecimento: ${ctx.destino || "—"}.`,
    `Horário: ${ctx.horario || "a confirmar com o SESMT"}.`,
    "A realização do exame é OBRIGATÓRIA e tem por objetivo preservar sua saúde ocupacional, bem como cumprir as obrigações legais da empresa. O não comparecimento sem justificativa formal poderá acarretar as medidas administrativas previstas em norma interna.",
    "Solicitamos o comparecimento no prazo máximo de 15 (quinze) dias a contar do recebimento deste ofício. Em caso de dúvidas, contate o SESMT pelo e-mail sesmt@dmnestaleiro.com.br.",
    "Atenciosamente,",
  ];
  paragrafos.forEach((p) => {
    const lines = doc.splitTextToSize(p, maxW);
    doc.text(lines, MARGIN, y, { align: "justify", maxWidth: maxW });
    y += lines.length * 5.5 + 3;
  });

  // Assinaturas (lado a lado: solicitante + ciência do colaborador)
  y = Math.max(y + 14, 220);
  const colW = (maxW - 10) / 2;
  // Solicitante
  doc.setDrawColor(15, 23, 42);
  doc.line(MARGIN, y, MARGIN + colW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(ctx.solicitante || "SESMT — DMN", MARGIN + colW / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(ctx.setor || "Segurança e Saúde no Trabalho", MARGIN + colW / 2, y + 9, { align: "center" });
  // Ciência
  doc.setTextColor(15, 23, 42);
  doc.line(MARGIN + colW + 10, y, MARGIN + colW * 2 + 10, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Ciência do(a) Colaborador(a)", MARGIN + colW + 10 + colW / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Recebido em ____/____/______`, MARGIN + colW + 10 + colW / 2, y + 9, { align: "center" });

  // Rodapé
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `${EMPRESA_INFO.razao_social} · CNPJ ${EMPRESA_INFO.cnpj} · ${EMPRESA_INFO.endereco} · ${EMPRESA_INFO.cidade_uf_cep}`,
    W / 2,
    287,
    { align: "center" },
  );
  doc.text(
    `Documento gerado pelo SIGMO em ${hoje} — PROCO-SGI-SST-01 (NR-7 / PCMSO)`,
    W / 2,
    290.5,
    { align: "center" },
  );

  const nomeArq = `oficio-convocacao-${(emp.nome ?? "servidor").toString().toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.pdf`;
  return { doc, fileName: nomeArq };
}

async function copyText(text: string, label: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não consegui copiar automaticamente. Selecione e copie manualmente.");
  }
}

export function ConvocacaoExamesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [janela, setJanela] = useState<Janela>("90");
  const [companyFilter, setCompanyFilter] = useState<string>("TODAS");
  const [q, setQ] = useState("");
  const [pdfPreview, setPdfPreview] = useState<{ doc: jsPDF; fileName: string; title: string } | null>(null);
  const [whatsPreview, setWhatsPreview] = useState<{ nome: string; phone: string; message: string } | null>(null);

  // Dados da solicitação do ofício (persistidos localmente)
  const [solicitante, setSolicitante] = useState("");
  const [setor, setSetor] = useState("SESMT — Segurança e Saúde no Trabalho");
  const [destino, setDestino] = useState("Ambulatório Médico — DMN Estaleiro");
  const [horario, setHorario] = useState("Seg. a Sex., 08:00 às 16:00");
  const [tipoExame, setTipoExame] = useState("Exame Médico Periódico");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sigmo:oficio-aso-ctx");
      if (raw) {
        const v = JSON.parse(raw);
        if (v.solicitante) setSolicitante(v.solicitante);
        if (v.setor) setSetor(v.setor);
        if (v.destino) setDestino(v.destino);
        if (v.horario) setHorario(v.horario);
        if (v.tipoExame) setTipoExame(v.tipoExame);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "sigmo:oficio-aso-ctx",
        JSON.stringify({ solicitante, setor, destino, horario, tipoExame }),
      );
    } catch { /* ignore */ }
  }, [solicitante, setor, destino, horario, tipoExame]);

  const { data: emps } = useQuery({
    queryKey: ["employees-convocacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, matricula, whatsapp, foto_url, data_aso, company_id, role_id, status")
        .eq("status", "ATIVO")
        .order("data_aso", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
    enabled: open,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [],
    enabled: open,
  });

  const cMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
  const rMap = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

  const linha = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const norm = (v: string) => (v ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const s = norm(q.trim());

    return (emps ?? [])
      .map((e: any) => {
        const asoData = e.data_aso ? new Date(e.data_aso) : null;
        const proximo = asoData ? addMonths(asoData, PERIODICIDADE_MESES) : null;
        const dias = proximo ? daysBetween(proximo, hoje) : null;
        return { emp: e, asoData, proximo, dias };
      })
      .filter((row) => {
        if (companyFilter !== "TODAS" && row.emp.company_id !== companyFilter) return false;
        if (s && !norm(row.emp.nome).includes(s) && !norm(row.emp.matricula ?? "").includes(s)) return false;
        if (janela === "TODOS") return true;
        if (row.dias === null) return janela === "VENCIDOS";
        if (janela === "VENCIDOS") return row.dias < 0;
        if (janela === "30") return row.dias <= 30;
        if (janela === "60") return row.dias <= 60;
        if (janela === "90") return row.dias <= 90;
        return true;
      });
  }, [emps, q, companyFilter, janela]);

  const counts = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let venc = 0, d30 = 0, d60 = 0, d90 = 0;
    (emps ?? []).forEach((e: any) => {
      const proximo = e.data_aso ? addMonths(new Date(e.data_aso), PERIODICIDADE_MESES) : null;
      const dias = proximo ? daysBetween(proximo, hoje) : null;
      if (dias === null || dias < 0) venc++;
      else if (dias <= 30) d30++;
      else if (dias <= 60) d60++;
      else if (dias <= 90) d90++;
    });
    return { venc, d30, d60, d90 };
  }, [emps]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col bg-gradient-to-br from-[#1a0612] via-[#2a0a1a] to-[#1a0612] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Stethoscope className="h-7 w-7 text-rose-300" />
            <span>Convocação de Exames Periódicos</span>
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Quem precisa renovar o ASO. Periodicidade padrão {PERIODICIDADE_MESES} meses (NR-7).
          </DialogDescription>
        </DialogHeader>

        {/* Janela buckets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <JanelaCard active={janela === "VENCIDOS"} onClick={() => setJanela("VENCIDOS")} icon={AlertTriangle} label="Vencidos / Sem ASO" value={counts.venc} tone="rose" />
          <JanelaCard active={janela === "30"} onClick={() => setJanela("30")} icon={Clock} label="Vence em 30 dias" value={counts.d30} tone="amber" />
          <JanelaCard active={janela === "60"} onClick={() => setJanela("60")} icon={Clock} label="Vence em 60 dias" value={counts.d60} tone="yellow" />
          <JanelaCard active={janela === "90"} onClick={() => setJanela("90")} icon={CalendarCheck} label="Vence em 90 dias" value={counts.d90} tone="emerald" />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-7 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 h-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              placeholder="Buscar por nome ou matrícula…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="md:col-span-4">
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-10 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as empresas</SelectItem>
                {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex items-center justify-end">
            <span className="text-[11px] font-black uppercase tracking-widest text-rose-200 bg-rose-500/15 border border-rose-400/30 rounded-full px-3 py-1.5">
              {linha.length}
            </span>
          </div>
        </div>

        {/* Dados da solicitação (vão para o cabeçalho do ofício) */}
        <details className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white">
          <summary className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-rose-200 select-none">
            Dados da solicitação do ofício {solicitante ? "✓" : "(obrigatório)"}
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-3">
            <Input
              className="md:col-span-4 h-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              placeholder="Solicitante (nome de quem pede o ASO) *"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
            />
            <Input
              className="md:col-span-4 h-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              placeholder="Setor solicitante"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
            />
            <Input
              className="md:col-span-4 h-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              placeholder="Tipo de exame"
              value={tipoExame}
              onChange={(e) => setTipoExame(e.target.value)}
            />
            <Input
              className="md:col-span-7 h-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              placeholder="Local de comparecimento (ex.: Ambulatório Médico — DMN)"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            />
            <Input
              className="md:col-span-5 h-9 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              placeholder="Horário (ex.: Seg-Sex 08:00–16:00)"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
            />
          </div>
        </details>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {linha.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Ninguém na janela selecionada. Tudo em dia! 🎉</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linha.map(({ emp, asoData, proximo, dias }) => {
                const st = statusOf(dias);
                const proxStr = proximo ? fmtDate(proximo) : "—";
                const hasWhats = !!(emp.whatsapp ?? "").replace(/\D/g, "");
                return (
                  <div
                    key={emp.id}
                    className={`flex flex-col md:flex-row md:items-center gap-3 rounded-xl border p-3 ${st.bg}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-white/10 overflow-hidden flex-shrink-0 ring-1 ring-white/20">
                        {emp.foto_url ? (
                          <img src={emp.foto_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-bold text-white/70">
                            {(emp.nome ?? "?").split(" ").slice(0, 2).map((p: string) => p[0]).join("")}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white truncate">{emp.nome}</div>
                        <div className="text-[11px] text-slate-300 flex items-center gap-2 truncate">
                          {emp.matricula && <span>#{emp.matricula}</span>}
                          {rMap.get(emp.role_id) && <span>· {rMap.get(emp.role_id)}</span>}
                          {cMap.get(emp.company_id) && (
                            <span className="inline-flex items-center gap-1">
                              · <Building2 className="h-3 w-3" /> {cMap.get(emp.company_id)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end gap-1 md:min-w-[180px]">
                      <span className={`text-[11px] font-black uppercase tracking-wider ${st.tone}`}>{st.label}</span>
                      <span className="text-[10px] text-slate-400">
                        Último ASO: {fmtDate(asoData)} · Próximo: {proxStr}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {hasWhats ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/30 text-emerald-200"
                          title="Enviar WhatsApp"
                          onClick={() => setWhatsPreview({
                            nome: emp.nome ?? "Funcionário",
                            phone: normalizeWhatsappPhone(emp),
                            message: buildWhatsappMessage(emp, proxStr),
                          })}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled className="bg-emerald-500/15 border-emerald-400/30 text-emerald-200 opacity-30" title="Funcionário sem WhatsApp cadastrado">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/5 hover:bg-white/10 border-white/15 text-white"
                        onClick={() => {
                          if (!solicitante.trim()) {
                            toast.error("Preencha quem está solicitando o ASO antes de gerar o ofício.");
                            return;
                          }
                          const numeroOficio = `${String(Date.now()).slice(-6)}/${new Date().getFullYear()}`;
                          const pdf = criarOficioPDF(
                            emp,
                            asoData,
                            proximo,
                            (rMap.get(emp.role_id) as string) ?? "",
                            (cMap.get(emp.company_id) as string) ?? "",
                            { solicitante, setor, destino, horario, tipoExame, numeroOficio },
                          );
                          setPdfPreview({ ...pdf, title: `Ofício de convocação — ${emp.nome ?? "Funcionário"}` });
                        }}
                        title="Visualizar ofício em PDF"
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Ofício
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-400 border-t border-white/10 pt-3">
          💡 Periodicidade padrão = 12 meses. Em breve: por cargo/risco (NR-7 6 meses para insalubres).
        </div>
      </DialogContent>
    </Dialog>
    <PDFPreviewDialog
      open={!!pdfPreview}
      onClose={() => setPdfPreview(null)}
      doc={pdfPreview?.doc ?? null}
      fileName={pdfPreview?.fileName ?? "oficio-convocacao.pdf"}
      title={pdfPreview?.title ?? "Ofício de convocação"}
    />
    <WhatsappPreviewDialog value={whatsPreview} onClose={() => setWhatsPreview(null)} />
    </>
  );
}

function WhatsappPreviewDialog({ value, onClose }: { value: { nome: string; phone: string; message: string } | null; onClose: () => void }) {
  const links = value ? buildWhatsappLinks(value.phone, value.message) : null;
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-[#071b13] via-[#092418] to-[#071b13] border-emerald-400/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageCircle className="h-5 w-5 text-emerald-300" />
            Mensagem de WhatsApp
          </DialogTitle>
          <DialogDescription className="text-emerald-100/75">
            Revise a convocação antes de abrir o WhatsApp. Se a rede bloquear, copie o texto e envie manualmente.
          </DialogDescription>
        </DialogHeader>

        {value && links && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">Funcionário</div>
                <div className="font-semibold truncate">{value.nome}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">Telefone</div>
                <div className="font-mono">+{value.phone}</div>
              </div>
            </div>

            <Textarea
              readOnly
              value={value.message}
              className="min-h-[180px] resize-none bg-white/95 text-slate-950 border-white/20"
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={() => copyText(value.message, "Mensagem")}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar mensagem
                </Button>
                <Button type="button" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={() => copyText(`+${value.phone}`, "Telefone")}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar telefone
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={links.app} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-300/40 bg-emerald-500/20 px-4 text-sm font-medium text-emerald-50 hover:bg-emerald-500/30">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir app
                </a>
                <a href={links.web} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-300/40 bg-emerald-500/20 px-4 text-sm font-medium text-emerald-50 hover:bg-emerald-500/30">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  WhatsApp Web
                </a>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JanelaCard({ active, onClick, icon: Icon, label, value, tone }: { active: boolean; onClick: () => void; icon: any; label: string; value: number; tone: "rose" | "amber" | "yellow" | "emerald" }) {
  const tones: Record<string, string> = {
    rose: "from-rose-500/25 to-rose-600/10 border-rose-400/40 text-rose-200",
    amber: "from-amber-500/25 to-amber-600/10 border-amber-400/40 text-amber-200",
    yellow: "from-yellow-500/20 to-yellow-600/10 border-yellow-300/30 text-yellow-100",
    emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-400/30 text-emerald-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 bg-gradient-to-br transition-all hover:-translate-y-0.5 ${tones[tone]} ${active ? "ring-2 ring-white/40 scale-[1.02]" : ""}`}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 opacity-80" />
        <span className="text-2xl font-black">{value}</span>
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-90">{label}</div>
    </button>
  );
}
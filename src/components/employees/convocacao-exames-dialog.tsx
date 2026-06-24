import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageCircle, FileDown, AlertTriangle, Clock, CalendarCheck, Stethoscope, Building2 } from "lucide-react";
import jsPDF from "jspdf";

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

function buildWhatsappLink(emp: any, proximoStr: string) {
  const nome = (emp.nome ?? "").split(" ")[0];
  const msg =
    `Olá, ${nome}! 👋\n\n` +
    `Aqui é da Segurança do Trabalho da DMN. Seu *Atestado de Saúde Ocupacional (ASO)* ` +
    `vence em *${proximoStr}*.\n\n` +
    `Precisamos agendar seu exame periódico. Pode confirmar um horário esta semana?\n\n` +
    `Obrigado! 🙏`;
  const fone = (emp.whatsapp ?? "").replace(/\D/g, "");
  const phone = fone.startsWith("55") ? fone : `55${fone}`;
  const text = encodeURIComponent(msg);
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // Em desktop vai direto pro WhatsApp Web (evita o api.whatsapp.com bloqueado em muitas redes corporativas).
  // Em mobile usa wa.me que abre o app nativo.
  return isMobile
    ? `https://wa.me/${phone}?text=${text}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
}

function baixarOficioPDF(emp: any, asoData: Date | null, proximo: Date | null, cargo: string, empresa: string) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const proxStr = proximo ? proximo.toLocaleDateString("pt-BR") : "—";
  const asoStr = asoData ? asoData.toLocaleDateString("pt-BR") : "—";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, MARGIN = 22;
  const maxW = W - MARGIN * 2;
  let y = 24;

  // Cabeçalho
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("OFÍCIO DE CONVOCAÇÃO — EXAME MÉDICO OCUPACIONAL", W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text("Serviço Especializado em Segurança e Medicina do Trabalho — SESMT / DMN", W / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 4;
  doc.setDrawColor(180);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 8;

  // Meta
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const meta: [string, string][] = [
    ["Servidor(a):", emp.nome ?? "—"],
    ...(emp.matricula ? [["Matrícula:", String(emp.matricula)]] as [string, string][] : []),
    ...(cargo ? [["Cargo/Função:", cargo]] as [string, string][] : []),
    ...(empresa ? [["Lotação:", empresa]] as [string, string][] : []),
    ["Último ASO:", asoStr],
    ["Vencimento previsto:", proxStr],
    ["Data:", hoje],
  ];
  meta.forEach(([k, v]) => {
    doc.setFont("times", "bold");
    doc.text(k, MARGIN, y);
    doc.setFont("times", "normal");
    doc.text(v, MARGIN + 42, y);
    y += 6;
  });

  y += 4;
  doc.setFont("times", "normal");
  doc.setFontSize(11);

  const paragrafos = [
    "Prezado(a) Servidor(a),",
    "Conforme determina a Norma Regulamentadora nº 7 (NR-7) do Ministério do Trabalho e Emprego, que dispõe sobre o Programa de Controle Médico de Saúde Ocupacional (PCMSO), e em cumprimento ao Sistema de Gestão Integrado de Segurança e Saúde no Trabalho (SGI-SST) da DMN, fica V.S.ª CONVOCADO(A) a comparecer ao Serviço Médico para realização do Exame Médico Periódico.",
    "A realização do exame é obrigatória e tem por objetivo a preservação da sua saúde, bem como o cumprimento das obrigações legais por parte desta instituição.",
    "Solicitamos o agendamento no prazo máximo de 15 (quinze) dias a contar do recebimento deste ofício, mediante contato com a área de Segurança e Saúde Ocupacional.",
    "Atenciosamente,",
  ];
  paragrafos.forEach((p) => {
    const lines = doc.splitTextToSize(p, maxW);
    doc.text(lines, MARGIN, y, { align: "justify", maxWidth: maxW });
    y += lines.length * 6 + 3;
  });

  // Assinatura
  y += 18;
  doc.line(W / 2 - 35, y, W / 2 + 35, y);
  y += 5;
  doc.setFont("times", "bold");
  doc.text("SESMT — DMN", W / 2, y, { align: "center" });
  y += 5;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("Segurança e Saúde no Trabalho", W / 2, y, { align: "center" });

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Documento gerado pelo SIGMO em ${hoje} — PROCO-SGI-SST-01 (NR-7 / PCMSO)`, W / 2, 287, { align: "center" });

  const nomeArq = `oficio-convocacao-${(emp.nome ?? "servidor").toString().toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.pdf`;
  doc.save(nomeArq);
}

export function ConvocacaoExamesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [janela, setJanela] = useState<Janela>("90");
  const [companyFilter, setCompanyFilter] = useState<string>("TODAS");
  const [q, setQ] = useState("");

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
                        <a
                          href={buildWhatsappLink(emp, proxStr)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/30 text-emerald-200"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          WhatsApp
                        </a>
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
                        onClick={() => baixarOficioPDF(emp, asoData, proximo, rMap.get(emp.role_id) as string ?? "", cMap.get(emp.company_id) as string ?? "")}
                        title="Baixar ofício em PDF"
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Ofício PDF
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
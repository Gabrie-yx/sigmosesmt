import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  User, Building2, BadgeCheck, CalendarDays, IdCard, Shield, Stethoscope,
  HardHat, ExternalLink, FileSignature, GraduationCap, AlertTriangle,
  Clock, Phone, MapPin, Activity, FileText, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";
import { useMemo } from "react";
import { openStorageFile } from "@/components/file-viewer";

type Props = {
  employeeId: string | null;
  open: boolean;
  onClose: () => void;
};

function daysUntil(date?: string | null) {
  if (!date) return null;
  const d = new Date(date.slice(0, 10)).getTime();
  const now = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((d - now) / 86400000);
}

function semaphore(days: number | null): { tone: "green" | "amber" | "red" | "muted"; label: string } {
  if (days === null) return { tone: "muted", label: "—" };
  if (days < 0) return { tone: "red", label: `vencido há ${Math.abs(days)}d` };
  if (days <= 30) return { tone: "amber", label: `${days}d p/ vencer` };
  return { tone: "green", label: `${days}d` };
}

const toneCls: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  red: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  muted: "bg-rose-100/5 text-rose-200/50 border-rose-100/10",
};

export function EmployeeQuickView({ employeeId, open, onClose }: Props) {
  const enabled = !!employeeId && open;

  const { data: emp, isLoading } = useQuery({
    queryKey: ["qv-employee", employeeId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, rg, matricula, admissao, status, foto_url, setor, data_nascimento, sexo, pis, whatsapp, whatsapp_emergencia, nome_contato, email, endereco, bairro, cidade, uf, cep, tipo_vinculo, companies(name, cnpj), roles(name, cbo, setor)")
        .eq("id", employeeId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: exams } = useQuery({
    queryKey: ["qv-exams", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_exams")
        .select("id, tipo_exame, natureza, data_realizacao, data_vencimento, aptidao, periodicidade_meses, anexo_path")
        .eq("employee_id", employeeId!)
        .order("data_realizacao", { ascending: false });
      return data ?? [];
    },
  });

  const { data: epis } = useQuery({
    queryKey: ["qv-epi", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("epi_deliveries")
        .select("id, item, ca, qtd, tamanho, data_entrega, data_devolucao, motivo_entrega")
        .eq("employee_id", employeeId!)
        .order("data_entrega", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: ossAtiva } = useQuery({
    queryKey: ["qv-oss", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("oss_emissoes")
        .select("cargo_snapshot, emitido_em, expira_em, status")
        .eq("employee_id", employeeId!)
        .eq("status", "ASSINADO")
        .order("emitido_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: trainings } = useQuery({
    queryKey: ["qv-train", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_attendees")
        .select("id, situacao, data_vencimento, trainings(titulo, tipo, data_realizacao, carga_horaria_h)")
        .eq("employee_id", employeeId!)
        .order("data_vencimento", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: convocacoes } = useQuery({
    queryKey: ["qv-conv", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("convocacoes_exames")
        .select("id, tipos_exame, convocado_em, data_limite, status, atendida_exam_id, atendida_em, employee_exams:atendida_exam_id(anexo_path)")
        .eq("employee_id", employeeId!)
        .order("convocado_em", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: atestados } = useQuery({
    queryKey: ["qv-atest", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_atestados")
        .select("id, tipo, data_inicio, dias_afastamento, cid, status")
        .eq("employee_id", employeeId!)
        .order("data_inicio", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: acidentes } = useQuery({
    queryKey: ["qv-acid", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("acidentes_trabalho")
        .select("id, data_acidente, tipo, dias_perdidos, descricao, numero_cat")
        .eq("employee_id", employeeId!)
        .order("data_acidente", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const lastAso = exams?.[0];
  const asoSem = semaphore(daysUntil(lastAso?.data_vencimento));
  const trainExpired = (trainings ?? []).filter((t: any) => {
    const d = daysUntil(t.data_vencimento);
    return d !== null && d < 0;
  }).length;
  const trainSoon = (trainings ?? []).filter((t: any) => {
    const d = daysUntil(t.data_vencimento);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const trainSem: { tone: "green" | "amber" | "red" | "muted"; label: string } =
    trainExpired > 0 ? { tone: "red", label: `${trainExpired} vencido(s)` } :
    trainSoon > 0 ? { tone: "amber", label: `${trainSoon} vencendo` } :
    (trainings?.length ?? 0) === 0 ? { tone: "muted", label: "sem treinos" } :
    { tone: "green", label: "em dia" };
  const convPend = (convocacoes ?? []).filter((c: any) => c.status === "PENDENTE").length;
  const convSem: { tone: "green" | "amber" | "red" | "muted"; label: string } =
    convPend > 0 ? { tone: "amber", label: `${convPend} pendente(s)` } : { tone: "green", label: "nenhuma" };

  const timeline = useMemo(() => {
    const items: { date: string; icon: any; tone: string; title: string; subtitle?: string }[] = [];
    (exams ?? []).forEach((e: any) =>
      items.push({ date: e.data_realizacao, icon: Stethoscope, tone: "emerald", title: `ASO ${e.natureza ?? e.tipo_exame}`, subtitle: e.aptidao }));
    (epis ?? []).forEach((e: any) =>
      items.push({ date: e.data_entrega, icon: HardHat, tone: "amber", title: `EPI · ${e.item}`, subtitle: `CA ${e.ca ?? "—"} · qtd ${e.qtd}` }));
    (trainings ?? []).forEach((t: any) => t.trainings?.data_realizacao &&
      items.push({ date: t.trainings.data_realizacao, icon: GraduationCap, tone: "sky", title: `Treino · ${t.trainings.titulo}`, subtitle: t.situacao }));
    (convocacoes ?? []).forEach((c: any) =>
      items.push({ date: c.convocado_em?.slice(0, 10), icon: FileText, tone: "violet", title: `Convocação ASO`, subtitle: (c.tipos_exame ?? []).join(", ") }));
    (atestados ?? []).forEach((a: any) =>
      items.push({ date: a.data_inicio, icon: Activity, tone: "rose", title: `Atestado ${a.tipo ?? ""}`, subtitle: `${a.dias_afastamento ?? 0}d · CID ${a.cid ?? "—"}` }));
    (acidentes ?? []).forEach((a: any) =>
      items.push({ date: a.data_acidente, icon: AlertTriangle, tone: "red", title: `Acidente${a.numero_cat ? ` CAT ${a.numero_cat}` : ""}`, subtitle: a.descricao?.slice(0, 80) }));
    return items.filter(i => i.date).sort((a, b) => b.date.localeCompare(a.date));
  }, [exams, epis, trainings, convocacoes, atestados, acidentes]);

  const statusCls =
    emp?.status === "ATIVO" ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
    : emp?.status === "DESLIGADO" ? "bg-rose-500/15 text-rose-300 border-rose-400/30"
    : "bg-amber-500/15 text-amber-300 border-amber-400/30";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl border-l border-rose-300/15 bg-gradient-to-br from-[#1a0408]/95 via-rose-950/40 to-[#1a0408]/95 backdrop-blur-xl text-rose-50 p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-rose-100/10">
          <SheetTitle className="text-rose-50 flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-rose-300" />
            Ficha Viva do Funcionário
          </SheetTitle>
          <SheetDescription className="text-rose-200/60 text-xs">
            Visão 360° em tempo real — semáforos recalculam conforme módulos são executados.
          </SheetDescription>
        </SheetHeader>

        {isLoading || !emp ? (
          <div className="py-10 text-center text-rose-200/60 text-sm">Carregando…</div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Header com semáforos */}
            <div className="px-5 py-4 border-b border-rose-100/10 space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl overflow-hidden border border-rose-100/20 bg-rose-100/5 shrink-0">
                  {emp.foto_url ? (
                    <img src={emp.foto_url} alt={emp.nome} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-rose-200/40">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold truncate">{emp.nome}</div>
                  <div className="text-[11px] text-rose-200/70 truncate">
                    {(emp.roles as any)?.name ?? "—"}
                    {(emp.roles as any)?.cbo && <span className="text-rose-200/40"> · CBO {(emp.roles as any).cbo}</span>}
                  </div>
                  <div className="text-[10px] text-rose-200/50 truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" />
                    {(emp.companies as any)?.name ?? "—"} · {emp.setor ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className={`${statusCls} text-[10px] font-bold tracking-wider`}>
                  {emp.status}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Sem icon={Stethoscope} label="ASO" tone={asoSem.tone} value={asoSem.label} />
                <Sem icon={GraduationCap} label="Treinos" tone={trainSem.tone} value={trainSem.label} />
                <Sem icon={HardHat} label="EPI" tone={(epis?.length ?? 0) > 0 ? "green" : "muted"} value={`${epis?.length ?? 0} itens`} />
                <Sem icon={FileText} label="Convoc." tone={convSem.tone} value={convSem.label} />
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="resumo" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="mx-5 mt-3 bg-rose-100/5 border border-rose-100/10 grid grid-cols-5 h-8">
                <TabsTrigger value="resumo" className="text-[11px] data-[state=active]:bg-rose-600 data-[state=active]:text-white">Resumo</TabsTrigger>
                <TabsTrigger value="saude" className="text-[11px] data-[state=active]:bg-rose-600 data-[state=active]:text-white">Saúde</TabsTrigger>
                <TabsTrigger value="treinos" className="text-[11px] data-[state=active]:bg-rose-600 data-[state=active]:text-white">Treinos</TabsTrigger>
                <TabsTrigger value="epi" className="text-[11px] data-[state=active]:bg-rose-600 data-[state=active]:text-white">EPI</TabsTrigger>
                <TabsTrigger value="timeline" className="text-[11px] data-[state=active]:bg-rose-600 data-[state=active]:text-white">Timeline</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-5">
                  <TabsContent value="resumo" className="m-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <Info icon={IdCard} label="CPF" value={emp.cpf ?? "—"} />
                      <Info icon={IdCard} label="RG" value={emp.rg ?? "—"} />
                      <Info icon={BadgeCheck} label="Matrícula" value={emp.matricula ?? "—"} />
                      <Info icon={IdCard} label="PIS" value={emp.pis ?? "—"} />
                      <Info icon={CalendarDays} label="Admissão" value={emp.admissao ? formatDateBR(emp.admissao) : "—"} />
                      <Info icon={CalendarDays} label="Nascimento" value={emp.data_nascimento ? formatDateBR(emp.data_nascimento) : "—"} />
                      <Info icon={User} label="Sexo" value={emp.sexo ?? "—"} />
                      <Info icon={BadgeCheck} label="Vínculo" value={emp.tipo_vinculo ?? "—"} />
                      <Info icon={Phone} label="WhatsApp" value={emp.whatsapp ?? "—"} />
                      <Info icon={Phone} label="Emergência" value={`${emp.nome_contato ?? "—"}${emp.whatsapp_emergencia ? " · " + emp.whatsapp_emergencia : ""}`} />
                    </div>
                    {(emp.endereco || emp.cidade) && (
                      <Info icon={MapPin} label="Endereço" value={`${emp.endereco ?? ""}${emp.bairro ? ", " + emp.bairro : ""}${emp.cidade ? " — " + emp.cidade : ""}${emp.uf ? "/" + emp.uf : ""}${emp.cep ? " · " + emp.cep : ""}`} />
                    )}
                    {ossAtiva && (
                      <div className="p-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 text-[11px]">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-semibold uppercase tracking-wider text-[10px]">
                          <FileSignature className="h-3 w-3" /> OS de Segurança ativa
                        </div>
                        <div className="mt-1 text-rose-100/80">{ossAtiva.cargo_snapshot}</div>
                        {ossAtiva.expira_em && (
                          <div className="text-rose-200/50 text-[10px]">Vence em {formatDateBR(ossAtiva.expira_em.slice(0, 10))}</div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="saude" className="m-0 space-y-3">
                    <Section title="Histórico de ASOs" empty={(exams?.length ?? 0) === 0}>
                      {(exams ?? []).map((e: any) => {
                        const sem = semaphore(daysUntil(e.data_vencimento));
                        return (
                          <Row key={e.id}
                            icon={Stethoscope}
                            title={`${e.natureza ?? e.tipo_exame}`}
                            subtitle={`Realizado ${formatDateBR(e.data_realizacao)}${e.aptidao ? " · " + e.aptidao : ""}`}
                            right={
                              <div className="flex items-center gap-1.5">
                                {e.anexo_path && (
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-rose-200 hover:text-white hover:bg-rose-500/20"
                                    onClick={() => openStorageFile("employee-docs", e.anexo_path, `ASO_${e.natureza ?? e.tipo_exame}_${e.data_realizacao}.pdf`)}>
                                    <FileText className="h-3 w-3 mr-1" />PDF
                                  </Button>
                                )}
                                <Badge variant="outline" className={`${toneCls[sem.tone]} text-[10px]`}>{sem.label}</Badge>
                              </div>
                            }
                          />
                        );
                      })}
                    </Section>
                    <Section title="Convocações" empty={(convocacoes?.length ?? 0) === 0}>
                      {(convocacoes ?? []).map((c: any) => {
                        const asoPath = c.employee_exams?.anexo_path as string | undefined;
                        return (
                          <Row key={c.id}
                            icon={FileText}
                            title={(c.tipos_exame ?? []).join(", ") || "Convocação"}
                            subtitle={`Convocado ${formatDateBR(c.convocado_em?.slice(0, 10))}${c.data_limite ? " · prazo " + formatDateBR(c.data_limite) : ""}${c.atendida_em ? " · atendida " + formatDateBR(c.atendida_em.slice(0,10)) : ""}`}
                            right={
                              <div className="flex items-center gap-1.5">
                                {asoPath && (
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-200 hover:text-white hover:bg-emerald-500/20"
                                    onClick={() => openStorageFile("employee-docs", asoPath, `ASO_convocacao.pdf`)}>
                                    <FileText className="h-3 w-3 mr-1" />ASO
                                  </Button>
                                )}
                                <Badge variant="outline" className={`text-[10px] ${c.status === "ATENDIDA" ? toneCls.green : c.status === "PENDENTE" ? toneCls.amber : toneCls.muted}`}>
                                  {c.status}
                                </Badge>
                              </div>
                            }
                          />
                        );
                      })}
                    </Section>
                    <Section title="Atestados" empty={(atestados?.length ?? 0) === 0}>
                      {(atestados ?? []).map((a: any) => (
                        <Row key={a.id}
                          icon={Activity}
                          title={`${a.tipo ?? "Atestado"} · ${a.dias_afastamento ?? 0}d`}
                          subtitle={`${formatDateBR(a.data_inicio)} · CID ${a.cid ?? "—"}`}
                          right={<Badge variant="outline" className={`${toneCls.muted} text-[10px]`}>{a.status ?? "—"}</Badge>}
                        />
                      ))}
                    </Section>
                  </TabsContent>

                  <TabsContent value="treinos" className="m-0 space-y-2">
                    <Section title="Treinamentos realizados" empty={(trainings?.length ?? 0) === 0}>
                      {(trainings ?? []).map((t: any) => {
                        const sem = semaphore(daysUntil(t.data_vencimento));
                        return (
                          <Row key={t.id}
                            icon={GraduationCap}
                            title={t.trainings?.titulo ?? "Treinamento"}
                            subtitle={`${t.trainings?.tipo ?? "—"} · ${t.trainings?.carga_horaria_h ?? "?"}h${t.trainings?.data_realizacao ? " · " + formatDateBR(t.trainings.data_realizacao) : ""}`}
                            right={
                              t.data_vencimento
                                ? <Badge variant="outline" className={`${toneCls[sem.tone]} text-[10px]`}>{sem.label}</Badge>
                                : <Badge variant="outline" className={`${toneCls.muted} text-[10px]`}>{t.situacao ?? "—"}</Badge>
                            }
                          />
                        );
                      })}
                    </Section>
                  </TabsContent>

                  <TabsContent value="epi" className="m-0 space-y-2">
                    <Section title="Entregas de EPI" empty={(epis?.length ?? 0) === 0}>
                      {(epis ?? []).map((e: any) => (
                        <Row key={e.id}
                          icon={HardHat}
                          title={`${e.item} ${e.tamanho ? "· " + e.tamanho : ""}`}
                          subtitle={`Entregue ${formatDateBR(e.data_entrega)} · qtd ${e.qtd}${e.ca ? " · CA " + e.ca : ""}${e.motivo_entrega ? " · " + e.motivo_entrega : ""}`}
                          right={
                            e.data_devolucao
                              ? <Badge variant="outline" className={`${toneCls.muted} text-[10px]`}>devolvido</Badge>
                              : <Badge variant="outline" className={`${toneCls.green} text-[10px]`}>ativo</Badge>
                          }
                        />
                      ))}
                    </Section>
                  </TabsContent>

                  <TabsContent value="timeline" className="m-0">
                    {timeline.length === 0 ? (
                      <div className="py-8 text-center text-rose-200/40 text-xs">Sem eventos registrados.</div>
                    ) : (
                      <ol className="relative border-l border-rose-100/15 ml-2 space-y-3">
                        {timeline.map((t, i) => (
                          <li key={i} className="ml-4">
                            <div className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-rose-400 border border-rose-200/40" />
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-100/[0.03] border border-rose-100/10">
                              <t.icon className="h-3.5 w-3.5 text-rose-300/80 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[12px] font-medium text-rose-50 truncate">{t.title}</div>
                                  <div className="text-[10px] text-rose-200/50 shrink-0">{formatDateBR(t.date)}</div>
                                </div>
                                {t.subtitle && <div className="text-[10px] text-rose-200/60 truncate">{t.subtitle}</div>}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>

            <div className="flex justify-between items-center px-5 py-3 border-t border-rose-100/10">
              <div className="text-[10px] text-rose-200/40 flex items-center gap-1">
                <Shield className="h-3 w-3" /> ISO 9001 · 45001 · rastreabilidade
              </div>
              <Button asChild size="sm" className="bg-rose-600 hover:bg-rose-700 text-white h-8">
                <Link to="/app/employees/$id" params={{ id: emp.id }} onClick={onClose}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Perfil completo
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-100/[0.03] border border-rose-100/10">
      <Icon className="h-3.5 w-3.5 text-rose-300/70 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-rose-200/50">{label}</div>
        <div className="text-rose-50 truncate">{value}</div>
      </div>
    </div>
  );
}

function Sem({ icon: Icon, label, tone, value }: { icon: any; label: string; tone: "green" | "amber" | "red" | "muted"; value: string }) {
  const dotCls =
    tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-rose-400" : "bg-rose-200/30";
  return (
    <div className={`p-2 rounded-xl border bg-gradient-to-br from-rose-100/[0.06] to-transparent ${toneCls[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-200/60">
        <Icon className="h-3 w-3" /> {label}
        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${dotCls}`} />
      </div>
      <div className="text-[11px] font-semibold text-rose-50 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-rose-200/50 px-1">{title}</div>
      {empty ? (
        <div className="py-4 text-center text-rose-200/40 text-[11px] border border-dashed border-rose-100/10 rounded-lg">Nenhum registro.</div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  );
}

function Row({ icon: Icon, title, subtitle, right }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-100/[0.03] border border-rose-100/10">
      <Icon className="h-3.5 w-3.5 text-rose-300/70 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-rose-50 truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-rose-200/60 truncate">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// silence unused-var warning for old icons kept for callers
void CheckCircle2; void XCircle; void AlertCircle; void Clock;
function _legacy({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="p-3 rounded-xl border border-rose-100/15 bg-gradient-to-br from-rose-100/[0.06] to-transparent">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-200/60">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-base font-semibold text-rose-50 mt-1">{value}</div>
      {hint && <div className="text-[10px] text-rose-200/50 mt-0.5">{hint}</div>}
    </div>
  );
}
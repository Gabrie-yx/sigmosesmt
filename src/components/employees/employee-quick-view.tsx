import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Building2, BadgeCheck, CalendarDays, IdCard, Shield, Stethoscope, HardHat, ExternalLink, FileSignature } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";

type Props = {
  employeeId: string | null;
  open: boolean;
  onClose: () => void;
};

export function EmployeeQuickView({ employeeId, open, onClose }: Props) {
  const enabled = !!employeeId && open;

  const { data: emp, isLoading } = useQuery({
    queryKey: ["qv-employee", employeeId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, rg, matricula, admissao, status, foto_url, sexo, data_nascimento, telefone, email, companies(name, cnpj), roles(name, cbo, setor)")
        .eq("id", employeeId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lastAso } = useQuery({
    queryKey: ["qv-aso", employeeId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_exams")
        .select("tipo, data_realizacao, data_vencimento, apto")
        .eq("employee_id", employeeId!)
        .order("data_realizacao", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: epiCount } = useQuery({
    queryKey: ["qv-epi", employeeId],
    enabled,
    queryFn: async () => {
      const { count } = await supabase
        .from("epi_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employeeId!);
      return count ?? 0;
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

  const statusCls =
    emp?.status === "ATIVO" ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
    : emp?.status === "DESLIGADO" ? "bg-rose-500/15 text-rose-300 border-rose-400/30"
    : "bg-amber-500/15 text-amber-300 border-amber-400/30";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl border-rose-300/15 bg-gradient-to-br from-[#1a0408]/95 via-rose-950/40 to-[#1a0408]/95 backdrop-blur-xl text-rose-50">
        <DialogHeader>
          <DialogTitle className="text-rose-50 flex items-center gap-2">
            <User className="h-5 w-5 text-rose-300" />
            Resumo do Funcionário
          </DialogTitle>
          <DialogDescription className="text-rose-200/60">
            Visão rápida — para detalhes completos abra o perfil.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !emp ? (
          <div className="py-10 text-center text-rose-200/60 text-sm">Carregando…</div>
        ) : (
          <div className="space-y-4">
            {/* Header card */}
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-rose-100/15 bg-gradient-to-br from-rose-100/5 to-transparent backdrop-blur-md">
              <div className="h-20 w-20 rounded-2xl overflow-hidden border border-rose-100/20 bg-rose-100/5 shrink-0">
                {emp.foto_url ? (
                  <img src={emp.foto_url} alt={emp.nome} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-rose-200/40">
                    <User className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold truncate">{emp.nome}</div>
                <div className="text-xs text-rose-200/70 truncate">
                  {(emp.roles as any)?.name ?? "—"}
                  {(emp.roles as any)?.cbo && <span className="text-rose-200/40"> · CBO {(emp.roles as any).cbo}</span>}
                </div>
                <div className="text-[11px] text-rose-200/50 truncate flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />
                  {(emp.companies as any)?.name ?? "—"}
                </div>
              </div>
              <Badge variant="outline" className={`${statusCls} text-[10px] font-bold tracking-wider`}>
                {emp.status}
              </Badge>
            </div>

            {/* Dados pessoais */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Info icon={IdCard} label="CPF" value={emp.cpf ?? "—"} />
              <Info icon={IdCard} label="RG" value={emp.rg ?? "—"} />
              <Info icon={BadgeCheck} label="Matrícula" value={emp.matricula ?? "—"} />
              <Info icon={CalendarDays} label="Admissão" value={emp.admissao ? formatDateBR(emp.admissao) : "—"} />
            </div>

            <Separator className="bg-rose-100/10" />

            {/* Resumo SST */}
            <div className="grid grid-cols-3 gap-3">
              <Stat
                icon={Stethoscope}
                label="Último ASO"
                value={lastAso?.data_realizacao ? formatDateBR(lastAso.data_realizacao) : "—"}
                hint={lastAso?.apto === false ? "Inapto" : lastAso?.data_vencimento ? `vence ${formatDateBR(lastAso.data_vencimento)}` : undefined}
              />
              <Stat
                icon={HardHat}
                label="EPIs entregues"
                value={String(epiCount ?? 0)}
              />
              <Stat
                icon={FileSignature}
                label="OS ativa"
                value={ossAtiva ? "Sim" : "Não"}
                hint={ossAtiva?.expira_em ? `vence ${formatDateBR(ossAtiva.expira_em.slice(0, 10))}` : undefined}
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-[10px] text-rose-200/40 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Acesso somente leitura
              </div>
              <Button asChild size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">
                <Link to="/app/employees/$id" params={{ id: emp.id }} onClick={onClose}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Abrir perfil completo
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
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
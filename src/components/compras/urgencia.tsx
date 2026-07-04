import { AlertTriangle, Clock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type Urgencia = "NORMAL" | "URGENTE" | "EMERGENCIA";

export const URGENCIA_HORAS: Record<Urgencia, number> = {
  NORMAL: 168,
  URGENTE: 48,
  EMERGENCIA: 24,
};

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  NORMAL: "Normal (7 dias)",
  URGENTE: "Urgente (48h)",
  EMERGENCIA: "Emergência (24h)",
};

const URGENCIA_STYLE: Record<Urgencia, string> = {
  NORMAL: "bg-slate-100 text-slate-700 border-slate-300",
  URGENTE: "bg-amber-100 text-amber-800 border-amber-300",
  EMERGENCIA: "bg-rose-100 text-rose-800 border-rose-400 animate-pulse",
};

const URGENCIA_ICON: Record<Urgencia, typeof Clock> = {
  NORMAL: Clock,
  URGENTE: AlertTriangle,
  EMERGENCIA: Flame,
};

export function UrgenciaBadge({ urgencia, slaDeadline, status }: {
  urgencia?: Urgencia | null;
  slaDeadline?: string | null;
  status?: string | null;
}) {
  const u = (urgencia ?? "NORMAL") as Urgencia;
  const Icon = URGENCIA_ICON[u];
  const emAndamento = !status || ["PENDENTE", "EM_COTACAO", "COTADA"].includes(status);
  const vencido =
    emAndamento && slaDeadline ? new Date(slaDeadline).getTime() < Date.now() : false;
  return (
    <Badge className={URGENCIA_STYLE[u] + " border flex items-center gap-1"}>
      <Icon className="h-3 w-3" />
      {u === "NORMAL" ? "Normal" : u === "URGENTE" ? "Urgente" : "Emergência"}
      {vencido && <span className="ml-1 font-bold">• SLA VENCIDO</span>}
    </Badge>
  );
}

export function UrgenciaSelect({ value, onChange, disabled }: {
  value: Urgencia;
  onChange: (v: Urgencia) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold">URGÊNCIA</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Urgencia)} disabled={disabled}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NORMAL">{URGENCIA_LABEL.NORMAL}</SelectItem>
          <SelectItem value="URGENTE">{URGENCIA_LABEL.URGENTE}</SelectItem>
          <SelectItem value="EMERGENCIA">{URGENCIA_LABEL.EMERGENCIA}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
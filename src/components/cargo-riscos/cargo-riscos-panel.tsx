import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ShieldCheck, Activity, FlaskConical, Search, Pencil } from "lucide-react";
import { EditarCargoRiscoDialog } from "./editar-cargo-risco-dialog";

type CargoRisco = {
  id: string;
  role_id: string;
  risco_id: string;
  intensidade: number | null;
  unidade: string | null;
  limite_tolerancia: number | null;
  tecnica_medicao: string | null;
  fonte_geradora: string | null;
  epi_atenuacao_db: number | null;
  status_avaliacao: "AVALIADO" | "PENDENTE" | "NAO_APLICAVEL" | "EM_REVISAO";
  insalubridade_grau: "MINIMO" | "MEDIO" | "MAXIMO" | "NAO_INSALUBRE" | null;
  periculosidade: boolean;
  aposentadoria_especial_anos: number | null;
  data_avaliacao: string | null;
  observacao: string | null;
  ativo: boolean;
  catalogo_riscos: { id: string; nome: string; categoria: string } | null;
  roles: { id: string; name: string } | null;
};

const STATUS_META: Record<CargoRisco["status_avaliacao"], { label: string; cls: string }> = {
  AVALIADO:       { label: "Avaliado",         cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  EM_REVISAO:     { label: "Em revisão",       cls: "bg-amber-100 text-amber-700 border-amber-200" },
  PENDENTE:       { label: "Pendente revisão", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  NAO_APLICAVEL:  { label: "Não aplicável",    cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const CAT_ICON: Record<string, ReactNode> = {
  FISICO:     <Activity className="h-3.5 w-3.5" />,
  QUIMICO:    <FlaskConical className="h-3.5 w-3.5" />,
  BIOLOGICO:  <ShieldCheck className="h-3.5 w-3.5" />,
  ERGONOMICO: <AlertTriangle className="h-3.5 w-3.5" />,
  ACIDENTE:   <AlertTriangle className="h-3.5 w-3.5" />,
};

export function CargoRiscosPanel({ roleId, lockRole = false }: { roleId?: string | null; lockRole?: boolean }) {
  const [selectedRole, setSelectedRole] = useState<string | "all">(roleId ?? "all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<CargoRisco | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-ativos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles").select("id, name").eq("ativo", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const effectiveRole = lockRole && roleId ? roleId : selectedRole;

  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["cargo_riscos", effectiveRole],
    queryFn: async () => {
      let qb = supabase
        .from("cargo_riscos")
        .select("*, catalogo_riscos(id, nome, categoria), roles(id, name)")
        .eq("ativo", true)
        .order("status_avaliacao", { ascending: true });
      if (effectiveRole !== "all") qb = qb.eq("role_id", effectiveRole);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as unknown as CargoRisco[];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return riscos;
    return riscos.filter((r) =>
      (r.catalogo_riscos?.nome ?? "").toLowerCase().includes(needle) ||
      (r.roles?.name ?? "").toLowerCase().includes(needle) ||
      (r.fonte_geradora ?? "").toLowerCase().includes(needle),
    );
  }, [riscos, q]);

  const stats = useMemo(() => ({
    total: riscos.length,
    pendentes: riscos.filter((r) => r.status_avaliacao === "PENDENTE").length,
    revisao: riscos.filter((r) => r.status_avaliacao === "EM_REVISAO").length,
    insalubres: riscos.filter((r) => r.insalubridade_grau && r.insalubridade_grau !== "NAO_INSALUBRE").length,
    apos_especial: riscos.filter((r) => r.aposentadoria_especial_anos != null).length,
  }), [riscos]);

  return (
    <div className="p-6 space-y-5">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!lockRole && (
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v)}>
            <SelectTrigger className="w-full sm:w-72 h-10 bg-white"><SelectValue placeholder="Filtrar por cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cargos</SelectItem>
              {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por risco, cargo ou fonte geradora..." className="pl-9 h-10 bg-white" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total" value={stats.total} tone="slate" />
        <Stat label="Pendentes" value={stats.pendentes} tone="rose" />
        <Stat label="Em revisão" value={stats.revisao} tone="amber" />
        <Stat label="Insalubres" value={stats.insalubres} tone="orange" />
        <Stat label="Aposent. especial" value={stats.apos_especial} tone="violet" />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-500">Carregando matriz de riscos…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold">Nenhum risco cadastrado ainda</p>
          <p className="text-sm mt-1">Apenas o cargo <b>Soldador</b> foi pré-populado como piloto a partir do LTCAT.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                  {CAT_ICON[r.catalogo_riscos?.categoria ?? ""] ?? <ShieldCheck className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-900">{r.catalogo_riscos?.nome ?? "—"}</h4>
                    <Badge className={STATUS_META[r.status_avaliacao].cls} variant="outline">
                      {STATUS_META[r.status_avaliacao].label}
                    </Badge>
                    {r.insalubridade_grau && r.insalubridade_grau !== "NAO_INSALUBRE" && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200" variant="outline">
                        Insalubridade {r.insalubridade_grau.toLowerCase()}
                      </Badge>
                    )}
                    {r.periculosidade && (
                      <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Periculosidade</Badge>
                    )}
                    {r.aposentadoria_especial_anos && (
                      <Badge className="bg-violet-100 text-violet-700 border-violet-200" variant="outline">
                        Aposent. esp. {r.aposentadoria_especial_anos}a
                      </Badge>
                    )}
                    {!lockRole && r.roles && (
                      <Badge variant="outline" className="bg-slate-50 text-slate-600">{r.roles.name}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-slate-600">
                    {r.intensidade != null && (
                      <Field label="Intensidade" value={`${r.intensidade} ${r.unidade ?? ""}`} highlight={r.limite_tolerancia != null && r.intensidade > r.limite_tolerancia} />
                    )}
                    {r.limite_tolerancia != null && (
                      <Field label="Limite NR-15" value={`${r.limite_tolerancia} ${r.unidade ?? ""}`} />
                    )}
                    {r.tecnica_medicao && <Field label="Técnica" value={r.tecnica_medicao} />}
                    {r.fonte_geradora && <Field label="Fonte" value={r.fonte_geradora} />}
                    {r.epi_atenuacao_db != null && <Field label="EPI atenua" value={`${r.epi_atenuacao_db} dB`} />}
                  </div>
                  {r.observacao && (
                    <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-slate-200 pl-2">{r.observacao}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(r)}
                  className="shrink-0 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Validar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <EditarCargoRiscoDialog
        row={editing}
        open={!!editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "slate"|"rose"|"amber"|"orange"|"violet" }) {
  const tones: Record<string,string> = {
    slate:  "bg-slate-50 text-slate-700 border-slate-200",
    rose:   "bg-rose-50 text-rose-700 border-rose-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <Card className={`p-3 border ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-black mt-0.5">{value}</div>
    </Card>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className={highlight ? "font-bold text-rose-700" : "font-semibold text-slate-700"}>{value}</span>
    </div>
  );
}
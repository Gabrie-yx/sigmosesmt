import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, Upload, AlertTriangle, Clock, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileViewerHost, openStorageFile } from "@/components/file-viewer";

export const Route = createFileRoute("/app/sesmt/convocacoes-aso")({
  component: ConvocacoesAsoPage,
  errorComponent: ({ error }) => <div className="p-6 text-red-300">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

function ConvocacoesAsoPage() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["convocacoes-aso-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convocacoes_exames")
        .select("id, employee_id, status, convocado_em, data_limite, tipos_exame, observacoes, janela, employees(id, nome, matricula, cpf)")
        .eq("status", "PENDENTE")
        .order("convocado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: atendidas } = useQuery({
    queryKey: ["convocacoes-aso-atendidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convocacoes_exames")
        .select("id, employee_id, status, convocado_em, atendida_em, tipos_exame, employees(id, nome, matricula), employee_exams:atendida_exam_id(anexo_path, aptidao, data_realizacao)")
        .eq("status", "ATENDIDA")
        .order("atendida_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <FileViewerHost />
      <div className="flex items-center gap-3">
        <Link to="/app/hoje" className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Hoje
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30 grid place-items-center">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Convocações de ASO pendentes</h1>
          <p className="text-sm text-slate-400">
            Colaboradores convocados que ainda não tiveram o ASO anexado. Ao registrar o exame, a convocação é fechada automaticamente.
          </p>
        </div>
      </div>

      {isLoading && <div className="text-slate-400 text-sm">Carregando…</div>}

      {!isLoading && (rows?.length ?? 0) === 0 && (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-6 text-emerald-200 text-sm">
          Nenhuma convocação em aberto. 🎉
        </div>
      )}

      <div className="grid gap-3">
        {rows?.map((r) => {
          const limite = r.data_limite ? new Date(r.data_limite) : null;
          const vencida = limite ? limite < today : false;
          const diasRest = limite ? Math.ceil((limite.getTime() - today.getTime()) / 86400000) : null;
          const emp = r.employees as { id: string; nome: string; matricula: string | null; cpf: string | null } | null;
          return (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4 hover:border-amber-400/30 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">{emp?.nome ?? "—"}</span>
                  {emp?.matricula && <Badge variant="outline" className="text-xs">Mat. {emp.matricula}</Badge>}
                  {vencida ? (
                    <Badge className="bg-red-500/15 text-red-200 ring-1 ring-red-400/30 gap-1">
                      <AlertTriangle className="h-3 w-3" /> Vencida
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30 gap-1">
                      <Clock className="h-3 w-3" /> {diasRest}d restantes
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {(r.tipos_exame ?? []).join(", ") || "ASO"} • convocado em{" "}
                  {new Date(r.convocado_em).toLocaleDateString("pt-BR")}
                  {r.observacoes ? ` • ${r.observacoes}` : ""}
                </div>
              </div>
              {emp && (
                <Link to="/app/employees/$id" params={{ id: emp.id }} search={{ tab: "saude" }}>
                  <Button size="sm" className="gap-2">
                    <Upload className="h-4 w-4" /> Anexar ASO
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {(atendidas?.length ?? 0) > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4" /> Últimas atendidas — ASO arquivado
          </div>
          <div className="grid gap-2">
            {atendidas?.map((r: any) => {
              const emp = r.employees;
              const path = r.employee_exams?.anexo_path as string | undefined;
              return (
                <div key={r.id} className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.04] p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{emp?.nome ?? "—"}</div>
                    <div className="text-[11px] text-slate-400">
                      {(r.tipos_exame ?? []).join(", ") || "ASO"}
                      {r.atendida_em && ` • atendida ${new Date(r.atendida_em).toLocaleDateString("pt-BR")}`}
                      {r.employee_exams?.aptidao && ` • ${r.employee_exams.aptidao}`}
                    </div>
                  </div>
                  {path ? (
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20"
                      onClick={() => openStorageFile("employee-docs", path, `ASO_${emp?.nome ?? "func"}.pdf`)}>
                      <FileText className="h-3.5 w-3.5" /> Ver ASO
                    </Button>
                  ) : (
                    <span className="text-[10px] text-amber-300/70">sem anexo</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

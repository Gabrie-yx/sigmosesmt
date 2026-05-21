import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MinusCircle, ArrowLeft, Save, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/sesmt/equipamentos-moveis/checklist/$equipamentoId")({
  component: ChecklistExecPage,
  head: () => ({ meta: [{ title: "Executar Checklist · SIGMO" }] }),
});

type Resposta = "OK" | "NC" | "NA";
type State = {
  horimetro_inicial: string;
  horimetro_final: string;
  operador_nome: string;
  mecanico_nome: string;
  observacoes: string;
  respostas: Record<string, { resposta: Resposta | null; observacao: string }>;
};

function ChecklistExecPage() {
  const { equipamentoId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const equip = useQuery({
    queryKey: ["equip", equipamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_moveis").select("*").eq("id", equipamentoId).single();
      if (error) throw error;
      return data;
    },
  });

  const modelo = useQuery({
    enabled: !!equip.data?.modelo_checklist_id,
    queryKey: ["modelo-completo", equip.data?.modelo_checklist_id],
    queryFn: async () => {
      const modId = equip.data!.modelo_checklist_id as string;
      const [{ data: m }, { data: secoes }, { data: itens }] = await Promise.all([
        supabase.from("checklist_modelos").select("*").eq("id", modId).single(),
        supabase.from("checklist_modelo_secoes").select("*").eq("modelo_id", modId).order("ordem"),
        supabase.from("checklist_modelo_itens").select("*, secao:checklist_modelo_secoes!inner(modelo_id)")
          .eq("secao.modelo_id", modId).eq("ativo", true).order("ordem"),
      ]);
      return { modelo: m, secoes: secoes ?? [], itens: itens ?? [] };
    },
  });

  const [state, setState] = useState<State>({
    horimetro_inicial: "",
    horimetro_final: "",
    operador_nome: "",
    mecanico_nome: "",
    observacoes: "",
    respostas: {},
  });

  // Init horimetro com o atual do equipamento
  useMemo(() => {
    if (equip.data && equip.data.horimetro_atual != null && !state.horimetro_inicial) {
      setState((s) => ({ ...s, horimetro_inicial: String(equip.data.horimetro_atual) }));
    }
  }, [equip.data?.horimetro_atual]);

  const setResp = (itemId: string, resposta: Resposta) => {
    setState((s) => ({
      ...s,
      respostas: {
        ...s.respostas,
        [itemId]: { resposta, observacao: s.respostas[itemId]?.observacao ?? "" },
      },
    }));
  };
  const setObs = (itemId: string, observacao: string) => {
    setState((s) => ({
      ...s,
      respostas: {
        ...s.respostas,
        [itemId]: { resposta: s.respostas[itemId]?.resposta ?? null, observacao },
      },
    }));
  };

  const totals = useMemo(() => {
    let ok = 0, nc = 0, na = 0, pendentes = 0;
    const itens = modelo.data?.itens ?? [];
    for (const it of itens) {
      const r = state.respostas[it.id]?.resposta;
      if (r === "OK") ok++;
      else if (r === "NC") nc++;
      else if (r === "NA") na++;
      else pendentes++;
    }
    return { ok, nc, na, pendentes, total: itens.length };
  }, [modelo.data, state.respostas]);

  const finalizar = useMutation({
    mutationFn: async () => {
      if (totals.pendentes > 0) throw new Error(`${totals.pendentes} item(ns) sem resposta`);
      if (!state.operador_nome) throw new Error("Informe o nome do operador");

      const status = totals.nc > 0 ? "COM_NC" : "CONFORME";

      const { data: exec, error: e1 } = await supabase.from("checklist_execucoes").insert({
        equipamento_id: equipamentoId,
        modelo_id: modelo.data!.modelo!.id,
        data: today,
        horimetro_inicial: state.horimetro_inicial ? parseFloat(state.horimetro_inicial) : null,
        horimetro_final: state.horimetro_final ? parseFloat(state.horimetro_final) : null,
        operador_nome: state.operador_nome,
        mecanico_nome: state.mecanico_nome || null,
        observacoes: state.observacoes || null,
        status,
        total_itens: totals.total,
        total_ok: totals.ok,
        total_nc: totals.nc,
        total_na: totals.na,
        created_by: user?.id,
      }).select().single();
      if (e1) throw e1;

      const respostas = Object.entries(state.respostas).map(([item_id, r]) => ({
        execucao_id: exec.id,
        item_id,
        resposta: r.resposta!,
        observacao: r.observacao || null,
      }));
      const { error: e2 } = await supabase.from("checklist_respostas").insert(respostas);
      if (e2) throw e2;

      // Atualiza horímetro atual do equipamento
      if (state.horimetro_final) {
        await supabase.from("equipamentos_moveis")
          .update({ horimetro_atual: parseFloat(state.horimetro_final) })
          .eq("id", equipamentoId);
      }
      return exec;
    },
    onSuccess: () => {
      toast.success("Checklist registrado com sucesso");
      navigate({ to: "/app/sesmt/equipamentos-moveis" });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  if (equip.isLoading || modelo.isLoading) {
    return <div className="p-8 text-center text-slate-400">Carregando…</div>;
  }
  if (!equip.data?.modelo_checklist_id) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center p-6 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="font-bold text-amber-800">Equipamento sem modelo de checklist vinculado.</p>
        <p className="text-sm text-amber-700 mt-1">Edite o cadastro para vincular um modelo DMN.</p>
      </div>
    );
  }

  const { modelo: m, secoes, itens } = modelo.data!;
  if (!m) return null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/sesmt/equipamentos-moveis" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.codigo} · Rev {m.revisao ?? "—"}</p>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-red-700" />
            {equip.data.tag} — {equip.data.nome}
          </h1>
        </div>
      </header>

      {/* Cabeçalho da execução */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Data</Label>
            <Input value={today} disabled />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Horím. Inicial</Label>
            <Input type="number" step="0.1" value={state.horimetro_inicial} onChange={(e) => setState({ ...state, horimetro_inicial: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Horím. Final</Label>
            <Input type="number" step="0.1" value={state.horimetro_final} onChange={(e) => setState({ ...state, horimetro_final: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest">Operador *</Label>
            <Input value={state.operador_nome} onChange={(e) => setState({ ...state, operador_nome: e.target.value })} placeholder="Nome do operador" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase tracking-widest">Mecânico Responsável</Label>
            <Input value={state.mecanico_nome} onChange={(e) => setState({ ...state, mecanico_nome: e.target.value })} placeholder="Nome do mecânico" />
          </div>
        </CardContent>
      </Card>

      {/* Sumário */}
      <div className="sticky top-2 z-10 grid grid-cols-4 gap-2">
        <Stat label="OK" v={totals.ok} cls="bg-emerald-100 text-emerald-700" />
        <Stat label="NC" v={totals.nc} cls="bg-red-100 text-red-700" />
        <Stat label="N/A" v={totals.na} cls="bg-slate-100 text-slate-600" />
        <Stat label="Pendentes" v={totals.pendentes} cls="bg-amber-100 text-amber-700" />
      </div>

      {/* Seções */}
      {secoes.map((sec) => {
        const secItens = itens.filter((i: any) => i.secao_id === sec.id);
        return (
          <Card key={sec.id}>
            <CardContent className="p-3">
              <div className="mb-2 pb-2 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seção {sec.numero}</p>
                <h3 className="text-base font-black text-slate-900">{sec.titulo}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {secItens.map((it: any) => {
                  const r = state.respostas[it.id];
                  return (
                    <div key={it.id} className="py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-slate-400 tabular-nums mt-1 shrink-0">{it.numero}</span>
                        <div className="flex-1 text-sm font-medium text-slate-800">
                          {it.descricao}
                          {it.criticidade === "ALTA" && <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200 text-[9px]">CRÍTICO</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2 ml-6">
                        <RespBtn active={r?.resposta === "OK"} onClick={() => setResp(it.id, "OK")} icon={<CheckCircle2 className="h-4 w-4" />} label="OK" cls="bg-emerald-600" />
                        <RespBtn active={r?.resposta === "NC"} onClick={() => setResp(it.id, "NC")} icon={<XCircle className="h-4 w-4" />} label="NC" cls="bg-red-600" />
                        <RespBtn active={r?.resposta === "NA"} onClick={() => setResp(it.id, "NA")} icon={<MinusCircle className="h-4 w-4" />} label="N/A" cls="bg-slate-500" />
                      </div>
                      {r?.resposta === "NC" && (
                        <Textarea
                          className="mt-2 ml-6 text-sm"
                          rows={2}
                          placeholder="Descreva a não conformidade (obrigatório para gerar O.S.)"
                          value={r.observacao}
                          onChange={(e) => setObs(it.id, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="p-4">
          <Label>Observações gerais</Label>
          <Textarea value={state.observacoes} onChange={(e) => setState({ ...state, observacoes: e.target.value })} rows={3} />
        </CardContent>
      </Card>

      <div className="sticky bottom-2 z-10">
        <Button
          onClick={() => finalizar.mutate()}
          disabled={finalizar.isPending}
          className="w-full bg-[#7B1E2B] hover:bg-[#5a1620] text-white font-black uppercase tracking-widest text-xs h-12"
        >
          <Save className="h-4 w-4 mr-2" />
          Finalizar Checklist {totals.nc > 0 && `(${totals.nc} NC → gera O.S.)`}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <div className={cn("rounded-lg p-2 text-center", cls)}>
      <div className="text-xl font-black tabular-nums">{v}</div>
      <div className="text-[9px] font-black uppercase tracking-widest">{label}</div>
    </div>
  );
}

function RespBtn({ active, onClick, icon, label, cls }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-black uppercase tracking-widest text-[11px] transition-all border",
        active ? `${cls} text-white border-transparent shadow-md` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
      )}
    >
      {icon} {label}
    </button>
  );
}
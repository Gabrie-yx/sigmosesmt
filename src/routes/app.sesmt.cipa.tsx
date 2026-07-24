import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ShieldCheck, Users, CalendarDays, ListChecks, Vote, Loader2 } from "lucide-react";

// CIPA — NR-05 (rev. Portaria MTP 4.219/2022) + Lei 14.457/2022 (Emprega + Mulher).
// MVP: cadastro de gestão/mandato, membros, reuniões, plano anual e calendário eleitoral.
// Sem estilo claro hardcoded — segue o tema dark do SIGMO.

export const Route = createFileRoute("/app/sesmt/cipa")({
  head: () => ({
    meta: [
      { title: "SIGMO — CIPA (NR-05 + Lei 14.457/2022)" },
      { name: "description", content: "Gestão da Comissão Interna de Prevenção de Acidentes e de Assédio — mandatos, reuniões, atas, plano anual e eleição." },
      { property: "og:title", content: "SIGMO — CIPA (NR-05)" },
      { property: "og:description", content: "Módulo CIPA/CIPAA integrado ao SGI-SST." },
    ],
  }),
  component: CipaPage,
});

type Gestao = {
  id: string;
  gestao: string;
  data_inicio: string;
  data_fim: string;
  status: "PLANEJAMENTO" | "ELEICAO" | "ATIVA" | "ENCERRADA";
  modo: "DESIGNADO" | "COMISSAO";
  grau_risco: number | null;
  grupo_nr05: string | null;
  num_empregados: number | null;
  efetivos_empregador: number | null;
  suplentes_empregador: number | null;
  efetivos_empregados: number | null;
  suplentes_empregados: number | null;
  presidente_id: string | null;
  vice_presidente_id: string | null;
  secretario_id: string | null;
  designado_employee_id: string | null;
  designado_termo_data: string | null;
  designado_termo_url: string | null;
  designado_treinamento_horas: number | null;
  designado_treinamento_data: string | null;
  assedio_canal_url: string | null;
  observacoes: string | null;
};

/**
 * Dimensionamento NR-05 (Quadro I, resumido).
 * Retorna sugestão de modo (DESIGNADO vs COMISSAO), composição paritária mínima
 * e carga horária de capacitação obrigatória.
 * Base: NR-05 itens 5.6.3/5.6.4 + Quadro I (Portaria MTP 4.219/2022).
 */
export function dimensionarCipa(gr: number | null, n: number | null) {
  if (!gr || !n || n <= 0) return null;
  // Piso de eleição paritária por grau de risco (Quadro I):
  // GR1/GR2: exige comissão a partir de 51 empregados.
  // GR3/GR3: comissão a partir de 20 emp; GR4: comissão a partir de 30 emp (20-29 = designado).
  const piso = gr === 4 ? 30 : gr === 3 ? 20 : gr === 2 ? 51 : 51;
  if (n < piso) {
    return {
      modo: "DESIGNADO" as const,
      efetivosEmpregador: 0,
      suplentesEmpregador: 0,
      efetivosEmpregados: 0,
      suplentesEmpregados: 0,
      cargaTreinamento: gr >= 3 ? 20 : 8,
      nota:
        n < 20
          ? `Estabelecimento com menos de 20 empregados: designado obrigatório (NR-05 item 5.6.3).`
          : `Grau de Risco ${gr} com ${n} empregados: abaixo do Quadro I → designa 1 empregado (NR-05 item 5.6.4). Sem estabilidade do art. 10 ADCT, salvo previsão em ACT/CCT.`,
    };
  }
  // Faixas simplificadas do Quadro I (composição mínima):
  const faixa =
    n <= 50 ? { ef: 1, su: 1 } :
    n <= 100 ? { ef: 3, su: 3 } :
    n <= 500 ? { ef: 4, su: 4 } :
    n <= 1000 ? { ef: 6, su: 6 } :
    { ef: 9, su: 7 };
  return {
    modo: "COMISSAO" as const,
    efetivosEmpregador: faixa.ef,
    suplentesEmpregador: faixa.su,
    efetivosEmpregados: faixa.ef,
    suplentesEmpregados: faixa.su,
    cargaTreinamento: gr >= 3 ? 20 : 8,
    nota: `Comissão paritária: ${faixa.ef} efetivos + ${faixa.su} suplentes por bancada. Mandato 1 ano, permitida 1 reeleição. Estabilidade dos eleitos: art. 10, II, "a" ADCT.`,
  };
}

function CipaPage() {
  const qc = useQueryClient();
  const [gestaoId, setGestaoId] = useState<string | null>(null);
  const [novaGestaoOpen, setNovaGestaoOpen] = useState(false);

  const { data: gestoes, isLoading } = useQuery({
    queryKey: ["cipa", "gestoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cipa_gestoes")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Gestao[];
    },
  });

  const gestaoAtiva = useMemo(
    () => (gestoes ?? []).find((g) => g.id === gestaoId) ?? (gestoes ?? []).find((g) => g.status === "ATIVA") ?? (gestoes ?? [])[0],
    [gestoes, gestaoId],
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-rose-800 to-rose-950 flex items-center justify-center shadow">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">CIPA — Comissão Interna de Prevenção</h1>
            <p className="text-xs text-muted-foreground">NR-05 (Portaria MTP 4.219/2022) · Lei 14.457/2022 (assédio)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={gestaoAtiva?.id ?? ""}
            onValueChange={(v) => setGestaoId(v || null)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecione uma gestão…" />
            </SelectTrigger>
            <SelectContent>
              {(gestoes ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  Gestão {g.gestao} · {statusLabel(g.status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setNovaGestaoOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova gestão
          </Button>
        </div>
      </header>

      {isLoading && (
        <Card className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
        </Card>
      )}

      {!isLoading && (gestoes ?? []).length === 0 && (
        <Card className="p-8 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="font-bold">Nenhuma gestão cadastrada</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            A CIPA é obrigatória para estabelecimentos enquadrados no Quadro I da NR-05 (verifique CNAE + número de
            empregados). Após a Lei 14.457/2022, a comissão também trata da prevenção e apuração de assédio.
          </p>
          <Button onClick={() => setNovaGestaoOpen(true)} className="gap-1 mt-2">
            <Plus className="h-4 w-4" /> Criar primeira gestão
          </Button>
        </Card>
      )}

      {gestaoAtiva && (
        <Tabs defaultValue="resumo">
          <TabsList>
            <TabsTrigger value="resumo"><ShieldCheck className="h-4 w-4 mr-1" /> Resumo</TabsTrigger>
            <TabsTrigger value="membros"><Users className="h-4 w-4 mr-1" /> Membros</TabsTrigger>
            <TabsTrigger value="reunioes"><CalendarDays className="h-4 w-4 mr-1" /> Reuniões / Atas</TabsTrigger>
            <TabsTrigger value="plano"><ListChecks className="h-4 w-4 mr-1" /> Plano Anual</TabsTrigger>
            <TabsTrigger value="eleicao"><Vote className="h-4 w-4 mr-1" /> Eleição</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-4">
            <ResumoGestao gestao={gestaoAtiva} />
          </TabsContent>
          <TabsContent value="membros" className="mt-4">
            <MembrosTab gestaoId={gestaoAtiva.id} />
          </TabsContent>
          <TabsContent value="reunioes" className="mt-4">
            <ReunioesTab gestaoId={gestaoAtiva.id} />
          </TabsContent>
          <TabsContent value="plano" className="mt-4">
            <PlanoTab gestaoId={gestaoAtiva.id} />
          </TabsContent>
          <TabsContent value="eleicao" className="mt-4">
            <EleicaoTab gestaoId={gestaoAtiva.id} />
          </TabsContent>
        </Tabs>
      )}

      <NovaGestaoDialog
        open={novaGestaoOpen}
        onClose={() => setNovaGestaoOpen(false)}
        onCreated={(id) => {
          setGestaoId(id);
          qc.invalidateQueries({ queryKey: ["cipa", "gestoes"] });
        }}
      />
    </div>
  );
}

function statusLabel(s: Gestao["status"]) {
  return { PLANEJAMENTO: "Planejamento", ELEICAO: "Em eleição", ATIVA: "Ativa", ENCERRADA: "Encerrada" }[s];
}

/* -------------------- RESUMO -------------------- */
function ResumoGestao({ gestao }: { gestao: Gestao }) {
  const dim = [
    ["Efetivos empregador", gestao.efetivos_empregador ?? 0],
    ["Suplentes empregador", gestao.suplentes_empregador ?? 0],
    ["Efetivos empregados", gestao.efetivos_empregados ?? 0],
    ["Suplentes empregados", gestao.suplentes_empregados ?? 0],
  ] as const;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-4 md:col-span-2">
        <h3 className="font-bold mb-2">Gestão {gestao.gestao}</h3>
        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
          <div><span className="opacity-60">Início:</span> {gestao.data_inicio}</div>
          <div><span className="opacity-60">Fim:</span> {gestao.data_fim}</div>
          <div><span className="opacity-60">Grupo NR-05:</span> {gestao.grupo_nr05 ?? "—"}</div>
          <div><span className="opacity-60">Empregados:</span> {gestao.num_empregados ?? "—"}</div>
          <div className="col-span-2"><span className="opacity-60">Status:</span> <Badge variant="secondary">{statusLabel(gestao.status)}</Badge></div>
        </div>
        {gestao.observacoes && <p className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap">{gestao.observacoes}</p>}
      </Card>
      <Card className="p-4">
        <h3 className="font-bold mb-2 text-sm">Dimensionamento (Quadro I NR-05)</h3>
        <ul className="text-sm space-y-1">
          {dim.map(([l, v]) => (
            <li key={l as string} className="flex justify-between"><span className="text-muted-foreground">{l}</span><b>{v}</b></li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground mt-3">
          Ajuste conforme o Quadro I da NR-05 para o seu CNAE × nº de empregados. Em estabelecimentos com &lt; 20 empregados, cabe o designado de CIPA (item 5.3.2).
        </p>
      </Card>
    </div>
  );
}

/* -------------------- MEMBROS -------------------- */
function MembrosTab({ gestaoId }: { gestaoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["cipa", "membros", gestaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cipa_membros")
        .select("*, employees:employee_id(id, nome, cargo)")
        .eq("gestao_id", gestaoId)
        .order("representacao");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Composição</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar membro</Button>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum membro cadastrado nesta gestão.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left p-2">Funcionário</th><th className="text-left p-2">Representação</th><th className="text-left p-2">Papel</th><th className="text-left p-2">Posse</th><th className="text-left p-2">Status</th></tr>
            </thead>
            <tbody>
              {(data as any[]).map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-2">{m.employees?.nome ?? "—"}<div className="text-[10px] text-muted-foreground">{m.employees?.cargo}</div></td>
                  <td className="p-2">{m.representacao === "EMPREGADOR" ? "Empregador (indicação)" : "Empregados (eleição)"}</td>
                  <td className="p-2">{m.papel}{m.votos ? ` · ${m.votos} votos` : ""}</td>
                  <td className="p-2">{m.posse_em ?? "—"}</td>
                  <td className="p-2"><Badge variant={m.status === "ATIVO" ? "default" : "secondary"}>{m.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NovoMembroDialog
        open={open}
        gestaoId={gestaoId}
        onClose={() => setOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cipa", "membros", gestaoId] })}
      />
    </Card>
  );
}

function NovoMembroDialog({ open, onClose, gestaoId, onSaved }: { open: boolean; onClose: () => void; gestaoId: string; onSaved: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [representacao, setRepresentacao] = useState<"EMPREGADOR" | "EMPREGADOS">("EMPREGADOS");
  const [papel, setPapel] = useState<"EFETIVO" | "SUPLENTE">("EFETIVO");
  const [votos, setVotos] = useState("");
  const [posseEm, setPosseEm] = useState("");

  const { data: funcs } = useQuery({
    queryKey: ["cipa", "employees-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, nome, cargo").eq("status", "ATIVO").order("nome").limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Selecione um funcionário");
      const { error } = await supabase.from("cipa_membros").insert({
        gestao_id: gestaoId,
        employee_id: employeeId,
        representacao,
        papel,
        votos: votos ? Number(votos) : null,
        posse_em: posseEm || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      onSaved();
      onClose();
      setEmployeeId(""); setVotos(""); setPosseEm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar membro à CIPA</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Funcionário</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(funcs ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome} — {f.cargo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Representação</Label>
              <Select value={representacao} onValueChange={(v) => setRepresentacao(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPREGADOR">Empregador (indicação)</SelectItem>
                  <SelectItem value="EMPREGADOS">Empregados (eleição)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={papel} onValueChange={(v) => setPapel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFETIVO">Efetivo</SelectItem>
                  <SelectItem value="SUPLENTE">Suplente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Votos (se eleito)</Label><Input type="number" value={votos} onChange={(e) => setVotos(e.target.value)} /></div>
            <div><Label>Posse em</Label><Input type="date" value={posseEm} onChange={(e) => setPosseEm(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- REUNIÕES -------------------- */
function ReunioesTab({ gestaoId }: { gestaoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["cipa", "reunioes", gestaoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cipa_reunioes").select("*").eq("gestao_id", gestaoId).order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold">Reuniões</h3>
          <p className="text-[10px] text-muted-foreground">NR-05 item 5.7.1 exige reuniões ordinárias mensais.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Agendar reunião</Button>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma reunião registrada.</p>
      ) : (
        <ul className="space-y-2">
          {(data as any[]).map((r) => (
            <li key={r.id} className="border border-border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{r.data} · {r.tipo}</div>
                  <div className="text-xs text-muted-foreground">{r.local ?? "—"} {r.hora ? `· ${r.hora}` : ""}</div>
                </div>
                <Badge variant={r.status === "REALIZADA" ? "default" : "secondary"}>{r.status}</Badge>
              </div>
              {r.pauta && <p className="text-xs mt-2 text-muted-foreground whitespace-pre-wrap"><b>Pauta:</b> {r.pauta}</p>}
            </li>
          ))}
        </ul>
      )}
      <NovaReuniaoDialog
        open={open}
        gestaoId={gestaoId}
        onClose={() => setOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cipa", "reunioes", gestaoId] })}
      />
    </Card>
  );
}

function NovaReuniaoDialog({ open, onClose, gestaoId, onSaved }: { open: boolean; onClose: () => void; gestaoId: string; onSaved: () => void }) {
  const [tipo, setTipo] = useState("ORDINARIA");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState("");
  const [pauta, setPauta] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Informe a data");
      const { error } = await supabase.from("cipa_reunioes").insert({ gestao_id: gestaoId, tipo, data, hora: hora || null, local: local || null, pauta: pauta || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reunião agendada");
      onSaved(); onClose();
      setData(""); setHora(""); setLocal(""); setPauta("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agendar reunião da CIPA</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORDINARIA">Ordinária</SelectItem>
                  <SelectItem value="EXTRAORDINARIA">Extraordinária</SelectItem>
                  <SelectItem value="POSSE">Posse</SelectItem>
                  <SelectItem value="ENCERRAMENTO">Encerramento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Hora</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div><Label>Local</Label><Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Sala/local" /></div>
          </div>
          <div><Label>Pauta</Label><Textarea rows={4} value={pauta} onChange={(e) => setPauta(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- PLANO ANUAL -------------------- */
function PlanoTab({ gestaoId }: { gestaoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["cipa", "plano", gestaoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cipa_plano_anual").select("*").eq("gestao_id", gestaoId).order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold">Plano anual de trabalho</h3>
          <p className="text-[10px] text-muted-foreground">Inclui ações de prevenção ao assédio (Lei 14.457/2022, art. 23).</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova ação</Button>
      </div>
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma ação cadastrada.</p>
      ) : (
        <ul className="space-y-2">
          {(data as any[]).map((p) => (
            <li key={p.id} className="border border-border rounded p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{p.acao}</div>
                <Badge variant="secondary">{p.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                <span>Eixo: {p.eixo}</span>
                {p.responsavel_nome && <span>Resp.: {p.responsavel_nome}</span>}
                {p.prazo && <span>Prazo: {p.prazo}</span>}
                {p.base_normativa && <span>Base: {p.base_normativa}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <NovoPlanoDialog
        open={open}
        gestaoId={gestaoId}
        onClose={() => setOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cipa", "plano", gestaoId] })}
      />
    </Card>
  );
}

function NovoPlanoDialog({ open, onClose, gestaoId, onSaved }: { open: boolean; onClose: () => void; gestaoId: string; onSaved: () => void }) {
  const [acao, setAcao] = useState("");
  const [eixo, setEixo] = useState("PREVENCAO");
  const [prazo, setPrazo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [base, setBase] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      if (!acao.trim()) throw new Error("Descreva a ação");
      const { error } = await supabase.from("cipa_plano_anual").insert({ gestao_id: gestaoId, acao, eixo, prazo: prazo || null, responsavel_nome: responsavel || null, base_normativa: base || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ação adicionada"); onSaved(); onClose(); setAcao(""); setPrazo(""); setResponsavel(""); setBase(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova ação do plano anual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Ação</Label><Textarea rows={3} value={acao} onChange={(e) => setAcao(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Eixo</Label>
              <Select value={eixo} onValueChange={setEixo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREVENCAO">Prevenção de acidentes</SelectItem>
                  <SelectItem value="ASSEDIO">Assédio (Lei 14.457)</SelectItem>
                  <SelectItem value="INSPECAO">Inspeção</SelectItem>
                  <SelectItem value="TREINAMENTO">Treinamento</SelectItem>
                  <SelectItem value="COMUNICACAO">Comunicação</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prazo</Label><Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
          </div>
          <div><Label>Responsável</Label><Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></div>
          <div><Label>Base normativa</Label><Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="Ex.: NR-05 item 5.4.2" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- ELEIÇÃO -------------------- */
const ETAPAS: Array<{ id: string; label: string }> = [
  { id: "CONSTITUICAO_COMISSAO_ELEITORAL", label: "Constituição da comissão eleitoral" },
  { id: "PUBLICACAO_EDITAL", label: "Publicação do edital" },
  { id: "INSCRICAO_CANDIDATOS", label: "Inscrição de candidatos (mín. 15 dias)" },
  { id: "CAMPANHA", label: "Campanha" },
  { id: "VOTACAO", label: "Votação (mín. 30 dias antes do fim do mandato)" },
  { id: "APURACAO", label: "Apuração" },
  { id: "HOMOLOGACAO", label: "Homologação" },
  { id: "POSSE", label: "Posse" },
];

function EleicaoTab({ gestaoId }: { gestaoId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["cipa", "eleicao", gestaoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cipa_calendario_eleicao").select("*").eq("gestao_id", gestaoId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byEtapa = useMemo(() => Object.fromEntries((data as any[] ?? []).map((r) => [r.etapa, r])), [data]);

  const upsert = useMutation({
    mutationFn: async (payload: { etapa: string; data_inicio: string; data_fim?: string | null; status: string }) => {
      const { error } = await supabase.from("cipa_calendario_eleicao").upsert({ gestao_id: gestaoId, ...payload }, { onConflict: "gestao_id,etapa" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa salva"); qc.invalidateQueries({ queryKey: ["cipa", "eleicao", gestaoId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <h3 className="font-bold mb-1">Calendário eleitoral</h3>
      <p className="text-[10px] text-muted-foreground mb-4">Prazos-referência da NR-05 (rev. 4.219/2022). Ajuste conforme o cronograma da comissão eleitoral.</p>
      <div className="space-y-2">
        {ETAPAS.map((e) => {
          const row = byEtapa[e.id];
          return (
            <EtapaLinha
              key={e.id}
              etapa={e}
              inicio={row?.data_inicio ?? ""}
              fim={row?.data_fim ?? ""}
              status={row?.status ?? "PLANEJADA"}
              onSave={(v) => upsert.mutate({ etapa: e.id, data_inicio: v.inicio, data_fim: v.fim || null, status: v.status })}
            />
          );
        })}
      </div>
    </Card>
  );
}

function EtapaLinha({ etapa, inicio, fim, status, onSave }: { etapa: { id: string; label: string }; inicio: string; fim: string; status: string; onSave: (v: { inicio: string; fim: string; status: string }) => void }) {
  const [ini, setIni] = useState(inicio);
  const [fi, setFi] = useState(fim);
  const [st, setSt] = useState(status);
  return (
    <div className="border border-border rounded p-3 grid grid-cols-1 md:grid-cols-[1fr_140px_140px_160px_100px] gap-2 items-end">
      <div className="text-sm font-medium">{etapa.label}</div>
      <div><Label className="text-[10px]">Início</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
      <div><Label className="text-[10px]">Fim</Label><Input type="date" value={fi} onChange={(e) => setFi(e.target.value)} /></div>
      <div>
        <Label className="text-[10px]">Status</Label>
        <Select value={st} onValueChange={setSt}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PLANEJADA">Planejada</SelectItem>
            <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
            <SelectItem value="CONCLUIDA">Concluída</SelectItem>
            <SelectItem value="ATRASADA">Atrasada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" disabled={!ini} onClick={() => onSave({ inicio: ini, fim: fi, status: st })}>Salvar</Button>
    </div>
  );
}

/* -------------------- NOVA GESTÃO -------------------- */
function NovaGestaoDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [gestao, setGestao] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [grupo, setGrupo] = useState("");
  const [num, setNum] = useState("");
  const [efE, setEfE] = useState("");
  const [suE, setSuE] = useState("");
  const [efF, setEfF] = useState("");
  const [suF, setSuF] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!gestao || !inicio || !fim) throw new Error("Preencha gestão, início e fim");
      const { data, error } = await supabase.from("cipa_gestoes").insert({
        gestao, data_inicio: inicio, data_fim: fim,
        grupo_nr05: grupo || null,
        num_empregados: num ? Number(num) : null,
        efetivos_empregador: efE ? Number(efE) : 0,
        suplentes_empregador: suE ? Number(suE) : 0,
        efetivos_empregados: efF ? Number(efF) : 0,
        suplentes_empregados: suF ? Number(suF) : 0,
        status: "PLANEJAMENTO",
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Gestão criada"); onCreated(id); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova gestão da CIPA</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Gestão</Label><Input placeholder="2026/2027" value={gestao} onChange={(e) => setGestao(e.target.value)} /></div>
            <div><Label>Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Grupo NR-05 (Quadro I)</Label><Input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: C-18" /></div>
            <div><Label>Nº empregados</Label><Input type="number" value={num} onChange={(e) => setNum(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><Label className="text-[10px]">Efetivos empregador</Label><Input type="number" value={efE} onChange={(e) => setEfE(e.target.value)} /></div>
            <div><Label className="text-[10px]">Suplentes empregador</Label><Input type="number" value={suE} onChange={(e) => setSuE(e.target.value)} /></div>
            <div><Label className="text-[10px]">Efetivos empregados</Label><Input type="number" value={efF} onChange={(e) => setEfF(e.target.value)} /></div>
            <div><Label className="text-[10px]">Suplentes empregados</Label><Input type="number" value={suF} onChange={(e) => setSuF(e.target.value)} /></div>
          </div>
          <p className="text-[10px] text-muted-foreground">Dimensionamento conforme Quadro I da NR-05 (CNAE × nº de empregados). Mandato: 1 ano, permitida 1 reeleição.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Criando…" : "Criar gestão"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
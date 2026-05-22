import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, X, Users, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type FuncRow = {
  key: string;
  employee_id: string | null;
  nome: string;
  externo: boolean;
  funcao?: string;
  transporte: boolean;
  alimentacao: boolean;
  presenca: string | null;
};

export function HoraExtraSabadoDialog({
  open,
  onOpenChange,
  editId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editId?: string | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Próximo sábado por padrão
  const proximoSabado = useMemo(() => {
    const d = new Date();
    const dow = d.getDay(); // 0=dom, 6=sáb
    const diff = (6 - dow + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }, []);

  const [data, setData] = useState(proximoSabado);
  const [turno, setTurno] = useState("1º");
  const [horaIni, setHoraIni] = useState("07:30");
  const [horaFim, setHoraFim] = useState("15:00");
  const [setoresSel, setSetoresSel] = useState<string[]>([]);
  const [setorNovo, setSetorNovo] = useState("");
  const [centroCusto, setCentroCusto] = useState("");
  const [tipoEfetivo, setTipoEfetivo] = useState<"DMN" | "MEI" | "TERCEIRIZADO">("DMN");
  const [companyId, setCompanyId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [funcs, setFuncs] = useState<FuncRow[]>([]);
  const [novoExternoNome, setNovoExternoNome] = useState("");
  const [novoExternoFuncao, setNovoExternoFuncao] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });
  const { data: setores } = useQuery({
    queryKey: ["he-setores"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("setor").not("setor", "is", null);
      return Array.from(new Set((data ?? []).map((d: any) => d.setor).filter(Boolean))).sort();
    },
  });
  const { data: employees } = useQuery({
    queryKey: ["he-employees", companyId],
    queryFn: async () => {
      let q = supabase.from("employees").select("id,nome,setor,company_id").eq("status", "ATIVO").order("nome");
      if (companyId) q = q.eq("company_id", companyId);
      return (await q).data ?? [];
    },
  });

  // Load when editing
  useEffect(() => {
    if (!editId || !open) return;
    (async () => {
      const { data: rec } = await supabase.from("hora_extra_sabado").select("*").eq("id", editId).maybeSingle();
      if (!rec) return;
      setData(rec.data);
      setTurno(rec.turno ?? "1º");
      setHoraIni(rec.horario_inicio ?? "07:30");
      setHoraFim(rec.horario_fim ?? "15:00");
      setSetoresSel(rec.setor ? String(rec.setor).split(",").map((s: string) => s.trim()).filter(Boolean) : []);
      setCentroCusto(rec.centro_custo ?? "");
      setTipoEfetivo((rec.tipo_efetivo as any) ?? "DMN");
      setCompanyId(rec.company_id ?? "");
      setObservacao(rec.observacao ?? "");
      const { data: list } = await supabase
        .from("hora_extra_sabado_funcionarios")
        .select("*")
        .eq("hora_extra_id", editId)
        .order("ordem");
      setFuncs(
        (list ?? []).map((f: any) => ({
          key: f.id,
          employee_id: f.employee_id,
          nome: f.nome,
          externo: f.externo,
          funcao: f.funcao ?? "",
          transporte: f.transporte,
          alimentacao: f.alimentacao,
          presenca: f.presenca,
        })),
      );
    })();
  }, [editId, open]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setData(proximoSabado);
      setTurno("1º"); setHoraIni("07:30"); setHoraFim("15:00");
      setSetoresSel([]); setSetorNovo(""); setCentroCusto(""); setTipoEfetivo("DMN");
      setCompanyId(""); setObservacao(""); setBusca(""); setFuncs([]);
      setNovoExternoNome(""); setNovoExternoFuncao("");
    }
  }, [open, proximoSabado]);

  const empsDisponiveis = useMemo(() => {
    const ids = new Set(funcs.filter((f) => f.employee_id).map((f) => f.employee_id));
    const s = busca.trim().toLowerCase();
    return (employees ?? [])
      .filter((e: any) => !ids.has(e.id))
      .filter((e: any) => !s || e.nome.toLowerCase().includes(s));
  }, [employees, funcs, busca]);

  function addEmp(e: any) {
    setFuncs((prev) => [
      ...prev,
      { key: crypto.randomUUID(), employee_id: e.id, nome: e.nome, externo: false, transporte: false, alimentacao: false, presenca: null },
    ]);
  }
  function addTodos() {
    const novos = empsDisponiveis.map((e: any) => ({
      key: crypto.randomUUID(),
      employee_id: e.id,
      nome: e.nome,
      externo: false,
      transporte: false,
      alimentacao: false,
      presenca: null,
    }));
    setFuncs((prev) => [...prev, ...novos]);
  }
  function addExterno() {
    const nome = novoExternoNome.trim();
    if (!nome) return;
    setFuncs((prev) => [
      ...prev,
      { key: crypto.randomUUID(), employee_id: null, nome, externo: true, funcao: novoExternoFuncao.trim(), transporte: false, alimentacao: false, presenca: null },
    ]);
    setNovoExternoNome(""); setNovoExternoFuncao("");
  }
  function remove(key: string) {
    setFuncs((prev) => prev.filter((f) => f.key !== key));
  }
  function toggle(key: string, field: "transporte" | "alimentacao") {
    setFuncs((prev) => prev.map((f) => (f.key === key ? { ...f, [field]: !f[field] } : f)));
  }
  function setPresenca(key: string, v: string | null) {
    setFuncs((prev) => prev.map((f) => (f.key === key ? { ...f, presenca: v } : f)));
  }
  function marcarTodos(field: "transporte" | "alimentacao", v: boolean) {
    setFuncs((prev) => prev.map((f) => ({ ...f, [field]: v })));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (funcs.length === 0) throw new Error("Adicione pelo menos um funcionário");
      const todosSetores = [...setoresSel];
      const extras = setorNovo.split(",").map((s) => s.trim()).filter(Boolean);
      for (const e of extras) if (!todosSetores.includes(e)) todosSetores.push(e);
      const setorFinal = todosSetores.length ? todosSetores.join(", ") : null;
      const payload = {
        data,
        turno: turno || null,
        horario_inicio: horaIni || null,
        horario_fim: horaFim || null,
        setor: setorFinal,
        centro_custo: centroCusto || null,
        tipo_efetivo: tipoEfetivo,
        company_id: companyId || null,
        observacao: observacao || null,
      };
      let id: string = editId ?? "";
      if (editId) {
        const { error } = await supabase.from("hora_extra_sabado").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("hora_extra_sabado_funcionarios").delete().eq("hora_extra_id", editId);
      } else {
        const { data: ins, error } = await supabase.from("hora_extra_sabado").insert({ ...payload, created_by: user?.id }).select("id").single();
        if (error) throw error;
        id = ins.id;
      }
      const rows = funcs.map((f, i) => ({
        hora_extra_id: id,
        employee_id: f.employee_id,
        nome: f.nome,
        externo: f.externo,
        funcao: f.funcao ? f.funcao : null,
        transporte: f.transporte,
        alimentacao: f.alimentacao,
        presenca: f.presenca,
        ordem: i,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("hora_extra_sabado_funcionarios").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hora-extra-sabado"] });
      toast.success(editId ? "Hora extra atualizada" : "Hora extra registrada");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Editar" : "Nova"} ficha de hora extra (sábado)</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="space-y-1"><Label>Turno</Label><Input value={turno} onChange={(e) => setTurno(e.target.value)} placeholder="1º" /></div>
          <div className="space-y-1"><Label>Horário início</Label><Input value={horaIni} onChange={(e) => setHoraIni(e.target.value)} placeholder="07:30" /></div>
          <div className="space-y-1"><Label>Horário fim</Label><Input value={horaFim} onChange={(e) => setHoraFim(e.target.value)} placeholder="15:00" /></div>

          <div className="space-y-1">
            <Label>Setor</Label>
            <Select value={setor} onValueChange={(v) => { setSetor(v); setSetorNovo(""); }}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(setores ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="mt-1" placeholder="ou digite um novo setor" value={setorNovo} onChange={(e) => { setSetorNovo(e.target.value); setSetor(""); }} />
          </div>
          <div className="space-y-1"><Label>C.C.</Label><Input value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Efetivo</Label>
            <Select value={tipoEfetivo} onValueChange={(v: any) => setTipoEfetivo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DMN">DMN</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="TERCEIRIZADO">Terceirizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Empresa</Label>
            <Select value={companyId || "_all"} onValueChange={(v) => setCompanyId(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Seletor de funcionários */}
        <div className="mt-4 rounded-xl border border-slate-200 p-3 bg-slate-50">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">Adicionar funcionários</p>
            <Button size="sm" variant="outline" onClick={addTodos} disabled={empsDisponiveis.length === 0}>
              <Users className="h-3.5 w-3.5 mr-1.5" />Adicionar todos ({empsDisponiveis.length})
            </Button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar funcionário…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border bg-white divide-y">
            {empsDisponiveis.slice(0, 50).map((e: any) => (
              <button key={e.id} type="button" onClick={() => addEmp(e)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 flex items-center justify-between">
                <span>{e.nome}</span>
                <Plus className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ))}
            {empsDisponiveis.length === 0 && <p className="px-3 py-3 text-xs text-slate-400 italic">Nenhum funcionário disponível.</p>}
          </div>
          {/* Externo */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-5" placeholder="Nome de pessoa externa" value={novoExternoNome} onChange={(e) => setNovoExternoNome(e.target.value)} />
            <Input className="md:col-span-4" placeholder="Função (opcional)" value={novoExternoFuncao} onChange={(e) => setNovoExternoFuncao(e.target.value)} />
            <Button className="md:col-span-3" variant="secondary" onClick={addExterno} disabled={!novoExternoNome.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar externo
            </Button>
          </div>
        </div>

        {/* Lista selecionada */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">Selecionados ({funcs.length})</p>
            {funcs.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => marcarTodos("transporte", true)}><CheckSquare className="h-3.5 w-3.5 mr-1" />Todos transporte</Button>
                <Button size="sm" variant="ghost" onClick={() => marcarTodos("transporte", false)}><Square className="h-3.5 w-3.5 mr-1" />Nenhum transp.</Button>
                <Button size="sm" variant="ghost" onClick={() => marcarTodos("alimentacao", true)}><CheckSquare className="h-3.5 w-3.5 mr-1" />Todos alim.</Button>
              </div>
            )}
          </div>
          {funcs.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-slate-400">Nenhum funcionário adicionado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-600">
                  <tr>
                    <th className="px-2 py-2 text-left w-10">#</th>
                    <th className="px-2 py-2 text-left">Nome</th>
                    <th className="px-2 py-2 text-center">Transp.</th>
                    <th className="px-2 py-2 text-center">Alim.</th>
                    <th className="px-2 py-2 text-center">Presença</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {funcs.map((f, i) => (
                    <tr key={f.key} className="border-t">
                      <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-medium">{f.nome}</span>
                        {f.externo && <span className="ml-2 text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Externo</span>}
                        {f.funcao && <span className="ml-2 text-xs text-slate-500">— {f.funcao}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={f.transporte} onCheckedChange={() => toggle(f.key, "transporte")} /></td>
                      <td className="px-2 py-1.5 text-center"><Checkbox checked={f.alimentacao} onCheckedChange={() => toggle(f.key, "alimentacao")} /></td>
                      <td className="px-2 py-1.5 text-center">
                        <Select value={f.presenca ?? "_"} onValueChange={(v) => setPresenca(f.key, v === "_" ? null : v)}>
                          <SelectTrigger className="h-8 w-24 mx-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_">—</SelectItem>
                            <SelectItem value="P">Presente</SelectItem>
                            <SelectItem value="F">Faltou</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Button size="icon" variant="ghost" onClick={() => remove(f.key)}><X className="h-4 w-4 text-rose-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1">
          <Label>Observação</Label>
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || funcs.length === 0}>
            {save.isPending ? "Salvando…" : editId ? "Salvar alterações" : "Criar ficha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

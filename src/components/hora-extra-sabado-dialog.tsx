import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpHint } from "@/components/help-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, X, Users, CheckSquare, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { toTitleCasePT } from "@/lib/utils";
import { logRead } from "@/lib/audit-read";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { loadDraft, deleteDraft } from "@/lib/draft-store";

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
  setorFixo,
  empresaFixaNome,
  moduloOrigem,
  moduloLabel,
  observacaoLabel,
  observacaoPlaceholder,
  funcionariosPermitidos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editId?: string | null;
  /** Trava o campo Setor com este valor e filtra funcionários por este setor. */
  setorFixo?: string;
  /** Trava a Empresa listando apenas a companhia com este nome (ex.: "DMN"). */
  empresaFixaNome?: string;
  /** Módulo de origem da ficha, usado para devolver indeferidas ao módulo correto. */
  moduloOrigem?: string;
  /** Rótulo do módulo (exibido no título quando escopado). */
  moduloLabel?: string;
  /** Rótulo do campo Observação. */
  observacaoLabel?: string;
  /** Placeholder do campo Observação. */
  observacaoPlaceholder?: string;
  /** Restringe a lista de funcionários disponíveis a estes nomes (match por substring, case-insensitive). */
  funcionariosPermitidos?: string[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (open && editId) logRead("hora_extra_sabado", editId, { via: "hora-extra-dialog" });
  }, [open, editId]);

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
  const [tipoDia, setTipoDia] = useState<"SABADO" | "DIA_UTIL">("SABADO");
  const [setoresSel, setSetoresSel] = useState<string[]>([]);
  const [setorNovo, setSetorNovo] = useState("");
  const [tipoEfetivo, setTipoEfetivo] = useState<"DMN" | "MEI" | "TERCEIRIZADO">("DMN");
  const [companyId, setCompanyId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [funcs, setFuncs] = useState<FuncRow[]>([]);
  const [novoExternoNome, setNovoExternoNome] = useState("");
  const [novoExternoFuncao, setNovoExternoFuncao] = useState("");

  // Rascunho: só para ficha nova (sem editId). Ao editar registro existente,
  // não faz sentido autosave em localStorage — a fonte da verdade é o DB.
  const DRAFT_KEY = "hora-extra-sabado-nova";
  const draftEnabled = open && !editId;
  const draftData = useMemo(
    () => ({
      data, turno, horaIni, horaFim, setoresSel, setorNovo,
      tipoEfetivo, companyId, observacao, funcs,
    }),
    [data, turno, horaIni, horaFim, setoresSel, setorNovo, tipoEfetivo, companyId, observacao, funcs],
  );
  useDraftAutosave(DRAFT_KEY, "Ficha de hora extra (sábado)", "/app/employees/hora-extra-sabado", draftData, {
    enabled: draftEnabled,
    delayMs: 800,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });
  // Empresas exibidas no dropdown — quando escopado, só a empresa fixa.
  const companiesFiltradas = useMemo(() => {
    const list = (companies ?? []) as { id: string; name: string }[];
    if (!empresaFixaNome) return list;
    const alvo = empresaFixaNome.trim().toLowerCase();
    return list.filter((c) => String(c.name ?? "").trim().toLowerCase().includes(alvo));
  }, [companies, empresaFixaNome]);

  // Ao abrir escopado, trava setor + empresa automaticamente.
  useEffect(() => {
    if (!open || editId) return;
    if (setorFixo) setSetoresSel([setorFixo]);
    if (empresaFixaNome && companiesFiltradas.length > 0) {
      setCompanyId(String(companiesFiltradas[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setorFixo, empresaFixaNome, companiesFiltradas.length]);

  const { data: setores } = useQuery({
    queryKey: ["he-setores"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("setor").not("setor", "is", null);
      const defaults = ["Produção", "Almoxarifado", "SESMT", "Manutenção", "Administrativo", "Qualidade"];
      const fromDb = (data ?? [])
        .flatMap((d: any) => String(d.setor ?? "").split(",").map((s) => s.trim()))
        .filter(Boolean);
      const siglas = new Set(["SESMT", "CIPA", "RH", "TI", "PCP", "QSMS"]);
      const normalize = (s: string) => {
        const up = s.trim().toUpperCase();
        if (siglas.has(up)) return up;
        return toTitleCasePT(s);
      };
      const all = [...defaults, ...fromDb].map(normalize).filter(Boolean);
      return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, "pt-BR"));
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

  // Ao fechar: zera estado em memória (o rascunho no localStorage já foi
  // persistido pelo autosave e será restaurado no próximo open).
  useEffect(() => {
    if (!open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ao abrir sem editId: restaura rascunho salvo (se existir).
  useEffect(() => {
    if (!open || editId) return;
    const draft = loadDraft<typeof draftData>(DRAFT_KEY);
    if (!draft) return;
    const d = draft.data;
    if (d.data) setData(d.data);
    if (d.turno != null) setTurno(d.turno);
    if (d.horaIni != null) setHoraIni(d.horaIni);
    if (d.horaFim != null) setHoraFim(d.horaFim);
    if (Array.isArray(d.setoresSel)) setSetoresSel(d.setoresSel);
    if (d.setorNovo != null) setSetorNovo(d.setorNovo);
    if (d.tipoEfetivo) setTipoEfetivo(d.tipoEfetivo);
    if (d.companyId != null) setCompanyId(d.companyId);
    if (d.observacao != null) setObservacao(d.observacao);
    if (Array.isArray(d.funcs)) setFuncs(d.funcs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  function resetForm() {
    setData(proximoSabado);
    setTurno("1º"); setHoraIni("07:30"); setHoraFim("15:00");
    setSetoresSel([]); setSetorNovo(""); setTipoEfetivo("DMN");
    setCompanyId(""); setObservacao(""); setBusca(""); setFuncs([]);
    setNovoExternoNome(""); setNovoExternoFuncao("");
  }

  const empsDisponiveis = useMemo(() => {
    const ids = new Set(funcs.filter((f) => f.employee_id).map((f) => f.employee_id));
    const s = busca.trim().toLowerCase();
    const setorAlvo = setorFixo ? setorFixo.trim().toLowerCase() : null;
    const permitidos = (funcionariosPermitidos ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean);
    return (employees ?? [])
      .filter((e: any) => !ids.has(e.id))
      .filter((e: any) => {
        if (permitidos.length > 0) {
          const nome = String(e.nome ?? "").toLowerCase();
          return permitidos.some((p) => nome.includes(p));
        }
        if (!setorAlvo) return true;
        const setores = String(e.setor ?? "").toLowerCase();
        return setores.split(",").map((x) => x.trim()).some((x) => x === setorAlvo);
      })
      .filter((e: any) => !s || e.nome.toLowerCase().includes(s));
  }, [employees, funcs, busca, setorFixo, funcionariosPermitidos]);

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
  function removerTodos() {
    setFuncs([]);
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
        modulo_origem: moduloOrigem ?? null,
        centro_custo: null,
        tipo_efetivo: tipoEfetivo,
        company_id: companyId || null,
        observacao: observacao || null,
        justificativa: observacao || null,
        tipo_convocacao: tipoDia === "SABADO" ? "SABADO" : "DIAS_UTEIS",
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
      if (moduloOrigem) qc.invalidateQueries({ queryKey: ["hora-extra-modulo", moduloOrigem] });
      toast.success(editId ? "Hora extra atualizada" : "Hora extra registrada");
      if (!editId) deleteDraft(DRAFT_KEY);
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto !p-5 !gap-3">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <DialogTitle className="text-lg font-semibold leading-tight">
              {editId ? "Editar ficha" : "Nova ficha"} de hora extra
            </DialogTitle>
            <span className={`text-[11px] font-semibold rounded px-1.5 py-0.5 ring-1 ${
              tipoDia === "SABADO"
                ? "text-amber-200 bg-amber-500/10 ring-amber-400/30"
                : "text-sky-200 bg-sky-500/10 ring-sky-400/30"
            }`}>
              {tipoDia === "SABADO" ? "Sábado" : "Dia útil"}
            </span>
            {moduloLabel && !editId && (
              <span className="text-[11px] font-semibold text-red-200 bg-red-500/10 ring-1 ring-red-400/30 rounded px-1.5 py-0.5">
                {moduloLabel}
              </span>
            )}
            <HelpHint topic="hora-extra-sabado" />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <div className="space-y-1">
            <Label>Tipo de dia</Label>
            <Select
              value={tipoDia}
              onValueChange={(v: "SABADO" | "DIA_UTIL") => {
                setTipoDia(v);
                if (v === "SABADO") {
                  setHoraIni("07:30"); setHoraFim("15:00");
                  // próximo sábado
                  const d = new Date();
                  const diff = (6 - d.getDay() + 7) % 7 || 7;
                  d.setDate(d.getDate() + diff);
                  setData(d.toISOString().slice(0, 10));
                } else {
                  setHoraIni("17:00"); setHoraFim("20:00");
                  // próximo dia útil (seg–sex)
                  const d = new Date();
                  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
                  setData(d.toISOString().slice(0, 10));
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SABADO">Sábado (07:30–15:00)</SelectItem>
                <SelectItem value="DIA_UTIL">Dia útil (a partir das 17:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="space-y-1"><Label>Turno</Label><Input value={turno} onChange={(e) => setTurno(e.target.value)} placeholder="1º" /></div>
          <div className="space-y-1"><Label>Horário início</Label><Input value={horaIni} onChange={(e) => setHoraIni(e.target.value)} placeholder="07:30" /></div>
          <div className="space-y-1"><Label>Horário fim</Label><Input value={horaFim} onChange={(e) => setHoraFim(e.target.value)} placeholder="15:00" /></div>

          <div className="space-y-1">
            <Label>Setor</Label>
            {setorFixo ? (
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium">
                {setorFixo}
              </div>
            ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <span className="truncate text-left">
                    {setoresSel.length === 0
                      ? <span className="text-muted-foreground">Selecionar…</span>
                      : setoresSel.length === 1
                        ? setoresSel[0]
                        : `${setoresSel.length} setores`}
                  </span>
                  <span className="ml-2 text-muted-foreground text-xs">▾</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-0">
                <div className="max-h-56 overflow-y-auto py-1">
                  {(setores ?? []).length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground italic">Nenhum setor cadastrado</p>
                  )}
                  {(setores ?? []).map((s) => {
                    const checked = setoresSel.includes(s);
                    return (
                      <label
                        key={s}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/40 px-3 py-1.5"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSetoresSel((prev) => (v ? [...prev, s] : prev.filter((x) => x !== s)))
                          }
                        />
                        <span>{s}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="border-t p-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="novo setor (vírgula p/ vários)"
                    value={setorNovo}
                    onChange={(e) => setSetorNovo(e.target.value)}
                  />
                </div>
              </PopoverContent>
            </Popover>
            )}
            {!setorFixo && setoresSel.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {setoresSel.map((s) => (
                  <span key={s} className="text-[10px] font-medium bg-white/[0.06] text-current/80 ring-1 ring-white/10 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    {s}
                    <button type="button" onClick={() => setSetoresSel((p) => p.filter((x) => x !== s))}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
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
            <Select value={companyId || "_all"} onValueChange={(v) => setCompanyId(v === "_all" ? "" : v)} disabled={!!empresaFixaNome}>
              <SelectTrigger><SelectValue placeholder={empresaFixaNome ?? "Todas"} /></SelectTrigger>
              <SelectContent>
                {!empresaFixaNome && <SelectItem value="_all">Todas</SelectItem>}
                {companiesFiltradas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Seletor de funcionários */}
        <div className="mt-3 rounded-xl border border-white/10 p-2.5 bg-white/[0.03]">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="text-[10px] font-black uppercase tracking-widest">Adicionar funcionários</p>
            <Button size="sm" variant="outline" onClick={addTodos} disabled={empsDisponiveis.length === 0} className="h-7 text-xs">
              <Users className="h-3.5 w-3.5 mr-1.5" />Adicionar todos ({empsDisponiveis.length})
            </Button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <Input className="pl-9 h-8" placeholder="Buscar funcionário…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border border-white/10 bg-white/[0.03] divide-y divide-white/10">
            {empsDisponiveis.slice(0, 50).map((e: any) => (
              <button key={e.id} type="button" onClick={() => addEmp(e)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.06] flex items-center justify-between">
                <span>{e.nome}</span>
                <Plus className="h-3.5 w-3.5 opacity-60" />
              </button>
            ))}
            {empsDisponiveis.length === 0 && <p className="px-3 py-3 text-xs opacity-60 italic">Nenhum funcionário disponível.</p>}
          </div>
          {/* Externo */}
          <div className="mt-2 grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-5 h-8" placeholder="Nome de pessoa externa" value={novoExternoNome} onChange={(e) => setNovoExternoNome(e.target.value)} />
            <Input className="md:col-span-4 h-8" placeholder="Função (opcional)" value={novoExternoFuncao} onChange={(e) => setNovoExternoFuncao(e.target.value)} />
            <Button className="md:col-span-3 h-8 text-xs" variant="secondary" onClick={addExterno} disabled={!novoExternoNome.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar externo
            </Button>
          </div>
        </div>

        {/* Lista selecionada */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest">Selecionados ({funcs.length})</p>
            {funcs.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => marcarTodos("transporte", true)}><CheckSquare className="h-3.5 w-3.5 mr-1" />Todos transp.</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => marcarTodos("transporte", false)}><Square className="h-3.5 w-3.5 mr-1" />Nenhum transp.</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => marcarTodos("alimentacao", true)}><CheckSquare className="h-3.5 w-3.5 mr-1" />Todos alim.</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/10" onClick={removerTodos}><Trash2 className="h-3.5 w-3.5 mr-1" />Remover todos</Button>
              </div>
            )}
          </div>
          {funcs.length === 0 ? (
            <p className="rounded-md border border-dashed border-white/15 p-3 text-center text-xs opacity-60">Nenhum funcionário adicionado ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.05] text-[10px] uppercase tracking-widest">
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
                    <tr key={f.key} className="border-t border-white/10">
                      <td className="px-2 py-1.5 opacity-60">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-medium">{f.nome}</span>
                        {f.externo && <span className="ml-2 text-[10px] uppercase font-bold text-amber-200 bg-amber-400/12 ring-1 ring-amber-300/25 px-1.5 py-0.5 rounded">Externo</span>}
                        {f.funcao && <span className="ml-2 text-xs opacity-70">— {f.funcao}</span>}
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
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(f.key)}><X className="h-4 w-4 text-rose-300" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <Label>{observacaoLabel ?? "Observação"}</Label>
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder={observacaoPlaceholder}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || funcs.length === 0}>
            {save.isPending ? "Salvando…" : editId ? "Salvar alterações" : "Criar ficha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, Search, Link2, Plus, FileText, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { PTE_RISCOS } from "@/lib/constants";
import { formatDateBR } from "@/lib/utils-date";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  aprId?: string | null;
  aprNumero?: string | null;
  aprLocal?: string | null;
  riscoSugerido?: string | null;
  empresaId?: string | null;
  onPick: (pteId: string) => void;
}

export function PteLookupSheet({
  open, onOpenChange, aprId, aprNumero, aprLocal, riscoSugerido, empresaId, onPick,
}: Props) {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"buscar" | "nova">("buscar");
  const [search, setSearch] = useState("");
  const [filtrarPorRisco, setFiltrarPorRisco] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const defaultRisco = useMemo(() => {
    if (riscoSugerido && PTE_RISCOS.includes(riscoSugerido as any)) return riscoSugerido;
    return PTE_RISCOS[0];
  }, [riscoSugerido]);

  const [form, setForm] = useState({
    data: today,
    risco: defaultRisco,
    local: aprLocal ?? "",
    employee_id: "",
    company_id: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, mounted, onOpenChange]);

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        risco: defaultRisco,
        local: f.local || aprLocal || "",
        company_id: f.company_id || empresaId || "",
      }));
      setFiltrarPorRisco(!!riscoSugerido);
    }
  }, [open, defaultRisco, aprLocal, riscoSugerido, empresaId]);

  const { data: ptes = [] } = useQuery({
    queryKey: ["ptes-lookup"],
    queryFn: async () =>
      (await supabase.from("ptes").select("id,numero,data,data_emissao,risco,local,status,employee_name,apr_id")
        .order("data_emissao", { ascending: false }).limit(200)).data ?? [],
    enabled: open,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-pte-lookup"],
    queryFn: async () =>
      (await supabase.from("companies").select("id,name").order("name")).data ?? [],
    enabled: open && tab === "nova",
  });

  const selectedCompanyId = form.company_id || empresaId || "";

  const { data: emps = [] } = useQuery({
    queryKey: ["employees-pte-lookup", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("employees").select("id,nome,matricula,company_id,status,role_id").eq("status", "ATIVO").order("nome");
      if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
      return (await q).data ?? [];
    },
    enabled: open && tab === "nova" && !!selectedCompanyId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-pte-lookup"],
    queryFn: async () =>
      (await supabase.from("roles").select("id,name")).data ?? [],
    enabled: open && tab === "nova",
  });
  const rolesMap = useMemo(() => new Map((roles as any[]).map((r) => [r.id, r.name])), [roles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = ptes as any[];
    if (filtrarPorRisco && riscoSugerido) {
      list = list.filter((p) => (p.risco ?? "") === riscoSugerido);
    }
    if (!q) return list;
    return list.filter((p) =>
      `${p.numero ?? ""} ${p.risco ?? ""} ${p.local ?? ""} ${p.employee_name ?? ""}`.toLowerCase().includes(q));
  }, [ptes, search, filtrarPorRisco, riscoSugerido]);

  const vincular = useMutation({
    mutationFn: async (pteId: string) => {
      const p = (ptes as any[]).find((x) => x.id === pteId);
      if (riscoSugerido && p && (p.risco ?? "") !== riscoSugerido) {
        const ok = window.confirm(
          `Esta PTE é de "${p.risco ?? "—"}", mas a categoria pendente é "${riscoSugerido}". ` +
          `Vincular mesmo assim NÃO vai cobrir a categoria pendente. Continuar?`,
        );
        if (!ok) throw new Error("Vínculo cancelado");
      }
      if (aprId) {
        const { error } = await supabase.from("ptes").update({ apr_id: aprId }).eq("id", pteId);
        if (error) throw error;
      }
      return pteId;
    },
    onSuccess: (pteId) => {
      qc.invalidateQueries({ queryKey: ["ptes"] });
      qc.invalidateQueries({ queryKey: ["ptes-light"] });
      qc.invalidateQueries({ queryKey: ["ptes-lookup"] });
      qc.invalidateQueries({ queryKey: ["ptes-by-apr"] });
      qc.invalidateQueries({ queryKey: ["ptes-linked-apr", aprId] });
      onPick(pteId);
      toast.success("PTE vinculada à APR");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.local.trim()) throw new Error("Informe o local");
      const emp = emps.find((e: any) => e.id === form.employee_id);
      const numero = `PTE-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const { data, error } = await supabase.from("ptes").insert({
        numero, data: form.data, risco: form.risco, local: form.local,
        status: "ATIVA", dados: {},
        employee_id: form.employee_id || null,
        employee_name: emp?.nome ?? null,
        company_id: emp?.company_id ?? selectedCompanyId ?? null,
        apr_id: aprId ?? null,
      }).select("id").single();
      if (error) throw error;
      return data!.id as string;
    },
    onSuccess: (pteId) => {
      qc.invalidateQueries({ queryKey: ["ptes"] });
      qc.invalidateQueries({ queryKey: ["ptes-light"] });
      qc.invalidateQueries({ queryKey: ["ptes-lookup"] });
      qc.invalidateQueries({ queryKey: ["ptes-by-apr"] });
      qc.invalidateQueries({ queryKey: ["ptes-linked-apr", aprId] });
      onPick(pteId);
      toast.success("PTE criada e vinculada");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end" role="dialog" aria-modal="true" aria-label="Vincular PTE à APR">
      <button
        type="button"
        aria-label="Fechar PTE"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <section className="relative z-[121] flex h-full w-full flex-col border-l border-rose-800/50 bg-[#120307] text-rose-50 shadow-[-30px_0_80px_rgba(0,0,0,0.65)] sm:max-w-xl">
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(160deg,rgba(15,5,8,0.99)_0%,rgba(55,8,22,0.98)_52%,rgba(10,2,4,0.99)_100%)]" />
        <div className="relative z-10 flex h-full min-h-0 flex-col">
        <header className="px-5 py-4 border-b border-rose-900/50 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="flex items-center gap-2 pr-10 text-lg font-black text-rose-100">
            <ShieldAlert className="h-5 w-5" /> Vincular PTE à APR
          </h2>
          <p className="mt-1 text-xs text-rose-200/70">
            {aprNumero ? <>APR <b className="text-rose-100">{aprNumero}</b></> : "Nova APR (não salva)"} ·
            Selecione uma PTE existente ou crie uma nova sem sair da APR.
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 grid grid-cols-2 shrink-0">
            <TabsTrigger value="buscar"><Search className="h-3.5 w-3.5 mr-1" /> Buscar existente</TabsTrigger>
            <TabsTrigger value="nova"><Plus className="h-3.5 w-3.5 mr-1" /> Nova PTE</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="flex-1 overflow-hidden flex flex-col p-5 pt-3 m-0">
            {riscoSugerido && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5">
                <div className="text-[11px] text-orange-900">
                  Categoria pendente: <b>{riscoSugerido}</b>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltrarPorRisco((v) => !v)}
                  className="text-[10px] font-black uppercase text-orange-700 hover:underline"
                >
                  {filtrarPorRisco ? "Mostrar todas" : "Filtrar por risco"}
                </button>
              </div>
            )}
            <Input
              placeholder="Buscar por número, risco, local, executante..."
              value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 shrink-0"
            />
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filtered.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  Nenhuma PTE encontrada
                  {filtrarPorRisco && riscoSugerido && (
                    <div className="mt-1 text-[10px]">Tente "Mostrar todas" ou crie uma nova na aba ao lado.</div>
                  )}
                </div>
              ) : filtered.map((p: any) => {
                const mismatch = !!riscoSugerido && (p.risco ?? "") !== riscoSugerido;
                return (
                <div key={p.id} className={`border rounded-lg p-3 transition ${mismatch ? "border-amber-300 bg-amber-50/40 hover:border-amber-400" : "border-slate-200 hover:border-orange-400 hover:bg-orange-50/40"}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-black text-[#991b1b]">{p.numero ?? p.id.slice(0, 8)}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${p.status === "ATIVA" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-700"><b>Risco:</b> {p.risco ?? "—"}</div>
                  <div className="text-[11px] text-slate-700"><b>Local:</b> {p.local ?? "—"}</div>
                  {p.employee_name && <div className="text-[11px] text-slate-600"><b>Executante:</b> {p.employee_name}</div>}
                  <div className="text-[10px] text-slate-400 mt-1">Emitida em {formatDateBR(p.data_emissao || p.data)}</div>
                  {p.apr_id && p.apr_id !== aprId && (
                    <div className="text-[10px] text-amber-700 mt-0.5">⚠ Já vinculada a outra APR — vínculo será atualizado</div>
                  )}
                  {mismatch && (
                    <div className="text-[10px] text-amber-800 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Não cobre a categoria pendente "{riscoSugerido}"
                    </div>
                  )}
                  <Button size="sm" className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-xs h-8"
                    onClick={() => vincular.mutate(p.id)} disabled={vincular.isPending}>
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular esta PTE
                  </Button>
                </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="nova" className="flex-1 overflow-y-auto p-5 pt-3 m-0 space-y-3">
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-500">Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-500">Classificação de risco</Label>
              <Select value={form.risco} onValueChange={(v) => setForm({ ...form, risco: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PTE_RISCOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-500">Local do trabalho</Label>
              <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })}
                placeholder="Ex.: Casco 23, deck superior" className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-500">
                Empresa {empresaId ? "(pré-selecionada pela APR)" : ""}
              </Label>
              <Select
                value={selectedCompanyId || "none"}
                onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? "" : v, employee_id: "" })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-500">
                Executante {selectedCompanyId ? "(filtrado pela empresa)" : "(selecione uma empresa)"}
              </Label>
              <Select
                value={form.employee_id || "none"}
                onValueChange={(v) => setForm({ ...form, employee_id: v === "none" ? "" : v })}
                disabled={!selectedCompanyId}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder={selectedCompanyId ? "Selecionar..." : "Escolha a empresa primeiro"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {emps.map((e: any) => {
                    const funcao = rolesMap.get(e.role_id);
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}{funcao ? ` — ${funcao}` : ""}{e.matricula ? ` · ${e.matricula}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {!aprId && (
              <div className="text-[10px] bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-amber-800">
                A APR ainda não foi salva — a nova PTE será criada sem vínculo. Salve a APR e use "Buscar existente" para vincular depois.
              </div>
            )}

            <Button onClick={() => criar.mutate()} disabled={criar.isPending}
              className="w-full bg-orange-600 hover:bg-orange-700 text-xs font-black uppercase">
              <FileText className="h-4 w-4 mr-1" /> Criar PTE{aprId ? " e vincular" : ""}
            </Button>
          </TabsContent>
        </Tabs>
        </div>
      </section>
    </div>,
    document.body,
  );
}
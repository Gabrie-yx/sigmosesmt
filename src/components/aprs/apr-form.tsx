import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Save, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { gerarAPR, type APRPdfRisco, type APRPdfAssinatura } from "@/lib/apr-pdf";
import { DEFAULT_TEXTO_GERAIS } from "@/lib/apr-pdf";
import { formatDateBR } from "@/lib/utils-date";

type APR = {
  id?: string; numero?: string;
  casco_id?: string | null; pte_id?: string | null;
  empresa_id?: string | null; encarregado_id?: string | null; tst_id?: string | null;
  local?: string | null; setor?: string | null;
  atividade_descricao: string;
  data_emissao: string; hora_inicio?: string | null; hora_fim?: string | null;
  validade_dias: number; data_validade?: string | null;
  condicoes_climaticas?: string | null; observacoes_gerais?: string | null;
  status: string; exige_pte: boolean;
  texto_gerais?: string | null;
};

type Risco = {
  id?: string; ordem: number;
  catalogo_risco_id?: string | null;
  risco_nome: string; risco_categoria?: string | null;
  efeitos_danos?: string | null;
  probabilidade: number; severidade: number; nivel_risco?: number;
  acoes_preventivas?: string | null;
  epis: string[]; nrs: string[];
  responsavel_acoes?: string | null;
};

type Assin = {
  id?: string; papel: "EXECUTANTE" | "TST" | "ENCARREGADO";
  employee_id?: string | null;
  nome: string; cpf?: string | null; funcao?: string | null;
  ordem: number;
  assinou_em?: string | null;
};

function nivelMeta(n: number) {
  // Escala homologada: P+S (2..6)
  switch (n) {
    case 2: return { label: "TRIVIAL", cls: "bg-emerald-500" };
    case 3: return { label: "TOLERÁVEL", cls: "bg-lime-500" };
    case 4: return { label: "MODERADO", cls: "bg-yellow-500" };
    case 5: return { label: "SUBSTANCIAL", cls: "bg-orange-500" };
    case 6: return { label: "INACEITÁVEL", cls: "bg-red-600" };
    default: return { label: "—", cls: "bg-slate-400" };
  }
}

const emptyApr: APR = {
  atividade_descricao: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  validade_dias: 7, status: "RASCUNHO", exige_pte: false,
  texto_gerais: DEFAULT_TEXTO_GERAIS,
};

export function AprForm({ aprId, onClose }: { aprId?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [apr, setApr] = useState<APR>(emptyApr);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assin[]>([]);
  const [tab, setTab] = useState<"cab" | "riscos" | "assin">("cab");

  // ---- catálogos ----
  const { data: cascos = [] } = useQuery({ queryKey: ["cascos-light"], queryFn: async () => (await supabase.from("cascos").select("id,numero,nome,status").eq("status", "ATIVO").order("numero")).data ?? [] });
  const { data: companies = [] } = useQuery({ queryKey: ["companies-light"], queryFn: async () => (await supabase.from("companies").select("id,name,cnpj").order("name")).data ?? [] });
  const { data: employees = [] } = useQuery({ queryKey: ["employees-light-apr"], queryFn: async () => (await supabase.from("employees").select("id,nome,cpf,company_id,role_id").eq("status", "ATIVO").order("nome")).data ?? [] });
  const { data: roles = [] } = useQuery({ queryKey: ["roles-light"], queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [] });
  const { data: catRiscos = [] } = useQuery({ queryKey: ["catalogo_riscos_form"], queryFn: async () => (await supabase.from("catalogo_riscos").select("*").eq("ativo", true).order("nome")).data ?? [] });
  const { data: ptes = [] } = useQuery({ queryKey: ["ptes-light"], queryFn: async () => (await supabase.from("ptes").select("id,numero,data_emissao,risco").order("data_emissao", { ascending: false }).limit(50)).data ?? [] });

  const empresa = useMemo(() => companies.find((c: any) => c.id === apr.empresa_id), [companies, apr.empresa_id]);
  const casco = useMemo(() => cascos.find((c: any) => c.id === apr.casco_id), [cascos, apr.casco_id]);
  const enc = useMemo(() => employees.find((e: any) => e.id === apr.encarregado_id), [employees, apr.encarregado_id]);
  const tst = useMemo(() => employees.find((e: any) => e.id === apr.tst_id), [employees, apr.tst_id]);
  const pte = useMemo(() => ptes.find((p: any) => p.id === apr.pte_id), [ptes, apr.pte_id]);

  // Detecta risco grave automaticamente — escala P+S, Substancial(5) ou Inaceitável(6) exigem PTE
  const temRiscoGrave = useMemo(() => riscos.some((r) => (r.probabilidade + r.severidade) >= 5), [riscos]);
  useEffect(() => {
    if (temRiscoGrave && !apr.exige_pte) setApr((a) => ({ ...a, exige_pte: true }));
  }, [temRiscoGrave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- carregar APR existente ----
  useEffect(() => {
    if (!aprId) return;
    (async () => {
      const [{ data: a }, { data: rs }, { data: ass }] = await Promise.all([
        supabase.from("aprs").select("*").eq("id", aprId).maybeSingle(),
        supabase.from("apr_riscos").select("*").eq("apr_id", aprId).order("ordem"),
        supabase.from("apr_assinaturas").select("*").eq("apr_id", aprId).order("papel").order("ordem"),
      ]);
      if (a) setApr(a as any);
      if (rs) setRiscos(rs as any);
      if (ass) setAssinaturas(ass as any);
    })();
  }, [aprId]);

  // ---- ações riscos ----
  function addRiscoFromCatalogo(catId: string) {
    const c = catRiscos.find((x: any) => x.id === catId);
    if (!c) return;
    setRiscos((rs) => [...rs, {
      ordem: rs.length + 1,
      catalogo_risco_id: c.id,
      risco_nome: c.nome,
      risco_categoria: c.categoria,
      efeitos_danos: (c.efeitos_tipicos ?? []).join(", "),
      probabilidade: 2, severidade: 2,
      acoes_preventivas: (c.medidas_controle_padrao ?? []).join("; "),
      epis: c.epis_sugeridos ?? [],
      nrs: c.nrs_aplicaveis ?? [],
      responsavel_acoes: "",
    }]);
  }
  function addRiscoLivre() {
    setRiscos((rs) => [...rs, {
      ordem: rs.length + 1, risco_nome: "", probabilidade: 1, severidade: 1,
      epis: [], nrs: [],
    }]);
  }
  function moveRisco(idx: number, dir: -1 | 1) {
    setRiscos((rs) => {
      const next = [...rs]; const j = idx + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((r, i) => ({ ...r, ordem: i + 1 }));
    });
  }
  function removeRisco(idx: number) {
    setRiscos((rs) => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, ordem: i + 1 })));
  }
  function updateRisco(idx: number, patch: Partial<Risco>) {
    setRiscos((rs) => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  // ---- ações assinaturas ----
  function addExecutante(empId?: string) {
    const e = employees.find((x: any) => x.id === empId);
    const role = e ? roles.find((r: any) => r.id === e.role_id) : null;
    setAssinaturas((arr) => [...arr, {
      papel: "EXECUTANTE",
      employee_id: e?.id ?? null,
      nome: e?.nome ?? "",
      cpf: e?.cpf ?? "",
      funcao: role?.name ?? "",
      ordem: arr.filter((a) => a.papel === "EXECUTANTE").length + 1,
    }]);
  }
  function removeAssin(idx: number) {
    setAssinaturas((arr) => arr.filter((_, i) => i !== idx));
  }
  function updateAssin(idx: number, patch: Partial<Assin>) {
    setAssinaturas((arr) => arr.map((a, i) => i === idx ? { ...a, ...patch } : a));
  }
  function toggleAssinou(idx: number) {
    updateAssin(idx, { assinou_em: assinaturas[idx].assinou_em ? null : new Date().toISOString() });
  }

  // Sincroniza encarregado/TST nas assinaturas quando o select muda
  useEffect(() => {
    setAssinaturas((arr) => {
      const others = arr.filter((a) => a.papel !== "ENCARREGADO" && a.papel !== "TST");
      const list: Assin[] = [...others];
      if (enc) {
        const role = roles.find((r: any) => r.id === enc.role_id);
        list.push({ papel: "ENCARREGADO", employee_id: enc.id, nome: enc.nome, cpf: enc.cpf, funcao: role?.name ?? "Encarregado", ordem: 1 });
      }
      if (tst) {
        const role = roles.find((r: any) => r.id === tst.role_id);
        list.push({ papel: "TST", employee_id: tst.id, nome: tst.nome, cpf: tst.cpf, funcao: role?.name ?? "TST", ordem: 1 });
      }
      return list;
    });
  }, [enc, tst, roles]);

  // ---- salvar ----
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!apr.atividade_descricao.trim()) throw new Error("Descreva a atividade");
      if (riscos.length === 0) throw new Error("Adicione ao menos 1 risco");
      if (riscos.some((r) => !r.risco_nome.trim())) throw new Error("Todo risco precisa de nome");

      const numero = apr.numero ?? (await supabase.rpc("gerar_numero_apr")).data as string;

      const payload: any = {
        numero,
        casco_id: apr.casco_id || null,
        pte_id: apr.pte_id || null,
        empresa_id: apr.empresa_id || null,
        encarregado_id: apr.encarregado_id || null,
        tst_id: apr.tst_id || null,
        local: apr.local || null,
        setor: apr.setor || null,
        atividade_descricao: apr.atividade_descricao,
        data_emissao: apr.data_emissao,
        hora_inicio: apr.hora_inicio || null,
        hora_fim: apr.hora_fim || null,
        validade_dias: apr.validade_dias,
        condicoes_climaticas: apr.condicoes_climaticas || null,
        observacoes_gerais: apr.observacoes_gerais || null,
        status: publish ? "ATIVA" : (apr.status || "RASCUNHO"),
        exige_pte: apr.exige_pte,
        texto_gerais: apr.texto_gerais ?? null,
      };

      let id = apr.id;
      if (id) {
        const { error } = await supabase.from("aprs").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("aprs").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      // Substituir riscos
      await supabase.from("apr_riscos").delete().eq("apr_id", id);
      if (riscos.length > 0) {
        const { error: e2 } = await supabase.from("apr_riscos").insert(
          riscos.map((r) => ({
            apr_id: id, ordem: r.ordem,
            catalogo_risco_id: r.catalogo_risco_id || null,
            risco_nome: r.risco_nome,
            risco_categoria: r.risco_categoria || null,
            efeitos_danos: r.efeitos_danos || null,
            probabilidade: r.probabilidade, severidade: r.severidade,
            acoes_preventivas: r.acoes_preventivas || null,
            epis: r.epis ?? [], nrs: r.nrs ?? [],
            responsavel_acoes: r.responsavel_acoes || null,
          })),
        );
        if (e2) throw e2;
      }

      // Substituir assinaturas
      await supabase.from("apr_assinaturas").delete().eq("apr_id", id);
      if (assinaturas.length > 0) {
        const { error: e3 } = await supabase.from("apr_assinaturas").insert(
          assinaturas.map((a) => ({
            apr_id: id, papel: a.papel,
            employee_id: a.employee_id || null,
            nome: a.nome, cpf: a.cpf || null, funcao: a.funcao || null,
            ordem: a.ordem, assinou_em: a.assinou_em || null,
          })),
        );
        if (e3) throw e3;
      }

      return id!;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["aprs"] });
      toast.success("APR salva");
      setApr((a) => ({ ...a, id }));
    },
    onError: (e: any) => toast.error(e.message),
  });

  function addAllExecutantesEmpresa() {
    if (!apr.empresa_id) { toast.error("Selecione a Empresa Executante na aba 1"); return; }
    const da = employees.filter((e: any) => e.company_id === apr.empresa_id);
    if (da.length === 0) { toast.warning("Nenhum colaborador encontrado para essa empresa"); return; }
    setAssinaturas((arr) => {
      const next = [...arr];
      da.forEach((e: any) => {
        if (next.some((a) => a.papel === "EXECUTANTE" && a.employee_id === e.id)) return;
        const role = roles.find((r: any) => r.id === e.role_id);
        next.push({
          papel: "EXECUTANTE", employee_id: e.id, nome: e.nome, cpf: e.cpf, funcao: role?.name ?? "",
          ordem: next.filter((a) => a.papel === "EXECUTANTE").length + 1,
        });
      });
      return next;
    });
    toast.success(`${da.length} executante(s) adicionado(s)`);
  }

  function handleImprimir() {
    if (!apr.atividade_descricao || riscos.length === 0) {
      toast.error("Salve a APR antes de imprimir");
      return;
    }
    const doc = gerarAPR({
      matrizNome: "J C S CONSTRUÇÃO NAVAL LTDA",
      matrizCnpj: "13.378.697/0001-80",
      numero: apr.numero ?? "APR-RASCUNHO",
      data_emissao: formatDateBR(apr.data_emissao),
      data_inicio: apr.data_emissao ? formatDateBR(apr.data_emissao) : null,
      data_fim: apr.data_validade ? formatDateBR(apr.data_validade) : null,
      hora_inicio: apr.hora_inicio,
      hora_fim: apr.hora_fim,
      data_validade: apr.data_validade ? formatDateBR(apr.data_validade) : null,
      empresa_nome: empresa?.name ?? null,
      empresa_cnpj: empresa?.cnpj ?? null,
      casco_numero: casco?.numero ?? null,
      casco_nome: casco?.nome ?? null,
      local: apr.local,
      setor: apr.setor,
      atividade: apr.atividade_descricao,
      servico_detalhado: apr.observacoes_gerais ?? null,
      elaborado_por: tst?.nome ?? null,
      encarregado: enc?.nome,
      tst: tst?.nome,
      pte_numero: pte?.numero ?? null,
      condicoes_climaticas: apr.condicoes_climaticas,
      observacoes: apr.observacoes_gerais,
      texto_gerais: apr.texto_gerais ?? null,
      riscos: riscos.map((r) => ({
        ordem: r.ordem,
        risco_nome: r.risco_nome,
        risco_categoria: r.risco_categoria,
        efeitos_danos: r.efeitos_danos,
        probabilidade: r.probabilidade,
        severidade: r.severidade,
        nivel_risco: r.probabilidade + r.severidade,
        acoes_preventivas: r.acoes_preventivas,
        epis: r.epis ?? [], nrs: r.nrs ?? [],
        responsavel_acoes: r.responsavel_acoes,
      } as APRPdfRisco)),
      assinaturas: assinaturas.map((a) => ({
        papel: a.papel, nome: a.nome, cpf: a.cpf, funcao: a.funcao,
      } as APRPdfAssinatura)),
    });
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs internas */}
      <div className="flex gap-1 p-2 bg-slate-100 border-b">
        {([
          ["cab", "1. Identificação"],
          ["riscos", `2. Riscos (${riscos.length})`],
          ["assin", `3. Assinaturas (${assinaturas.length})`],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === k ? "bg-[#991b1b] text-white shadow" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >{l}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImprimir} disabled={!apr.id}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => save.mutate(false)} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
          </Button>
          <Button size="sm" onClick={() => save.mutate(true)} disabled={save.isPending}>
            <FileText className="h-4 w-4 mr-1" /> Emitir APR
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "cab" && (
          <div className="space-y-4 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Casco / Embarcação</Label>
                <Select value={apr.casco_id ?? "none"} onValueChange={(v) => setApr({ ...apr, casco_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {cascos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.numero}{c.nome ? ` · ${c.nome}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa Executante</Label>
                <Select value={apr.empresa_id ?? "none"} onValueChange={(v) => setApr({ ...apr, empresa_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhuma —</SelectItem>
                    {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>PTE Vinculada {apr.exige_pte && <span className="text-rose-600">*</span>}</Label>
                <Select value={apr.pte_id ?? "none"} onValueChange={(v) => setApr({ ...apr, pte_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="— Sem PTE —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem PTE —</SelectItem>
                    {ptes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.numero ?? p.id.slice(0, 8)} · {formatDateBR(p.data_emissao)} · {p.risco}</SelectItem>)}
                  </SelectContent>
                </Select>
                {apr.exige_pte && !apr.pte_id && (
                  <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Risco ALTO/CRÍTICO exige PTE
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>Local</Label>
                <Input value={apr.local ?? ""} onChange={(e) => setApr({ ...apr, local: e.target.value })} placeholder="Ex.: Casario do Casco 23, deck superior" />
              </div>
              <div>
                <Label>Setor</Label>
                <Input value={apr.setor ?? ""} onChange={(e) => setApr({ ...apr, setor: e.target.value })} placeholder="Ex.: Construção Naval" />
              </div>
            </div>

            <div>
              <Label>Descrição da Atividade *</Label>
              <Textarea
                rows={3}
                value={apr.atividade_descricao}
                onChange={(e) => setApr({ ...apr, atividade_descricao: e.target.value })}
                placeholder="Descreva a atividade a ser executada..."
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Data emissão</Label>
                <Input type="date" value={apr.data_emissao} onChange={(e) => setApr({ ...apr, data_emissao: e.target.value })} />
              </div>
              <div>
                <Label>Hora início</Label>
                <Input type="time" value={apr.hora_inicio ?? ""} onChange={(e) => setApr({ ...apr, hora_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Hora fim</Label>
                <Input type="time" value={apr.hora_fim ?? ""} onChange={(e) => setApr({ ...apr, hora_fim: e.target.value })} />
              </div>
              <div>
                <Label>Validade (dias)</Label>
                <Select value={String(apr.validade_dias)} onValueChange={(v) => setApr({ ...apr, validade_dias: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Encarregado Responsável</Label>
                <Select value={apr.encarregado_id ?? "none"} onValueChange={(v) => setApr({ ...apr, encarregado_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Técnico de Segurança (TST)</Label>
                <Select value={apr.tst_id ?? "none"} onValueChange={(v) => setApr({ ...apr, tst_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Condições climáticas</Label>
                <Input value={apr.condicoes_climaticas ?? ""} onChange={(e) => setApr({ ...apr, condicoes_climaticas: e.target.value })} placeholder="Ex.: Ensolarado, vento moderado" />
              </div>
              <div>
                <Label>Observações gerais</Label>
                <Input value={apr.observacoes_gerais ?? ""} onChange={(e) => setApr({ ...apr, observacoes_gerais: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {tab === "riscos" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <Select onValueChange={addRiscoFromCatalogo}>
                <SelectTrigger className="w-[320px]"><SelectValue placeholder="+ Adicionar do catálogo..." /></SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {catRiscos.map((c: any) => <SelectItem key={c.id} value={c.id}>[{c.categoria}] {c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={addRiscoLivre}>
                <Plus className="h-4 w-4 mr-1" /> Risco manual
              </Button>
              {temRiscoGrave && (
                <span className="ml-auto text-xs font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5" /> Risco ALTO/CRÍTICO detectado — PTE obrigatória
                </span>
              )}
            </div>

            {riscos.length === 0 ? (
              <div className="text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
                Nenhum risco adicionado. Selecione no catálogo acima ou adicione manualmente.
              </div>
            ) : (
              <div className="space-y-3">
                {riscos.map((r, idx) => {
                  const nivel = r.probabilidade * r.severidade;
                  const meta = nivelMeta(nivel);
                  return (
                    <div key={idx} className="border-2 border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="bg-slate-700 text-white font-black text-xs rounded px-2 py-1">#{r.ordem}</span>
                        <Input
                          value={r.risco_nome}
                          onChange={(e) => updateRisco(idx, { risco_nome: e.target.value })}
                          placeholder="Nome do risco"
                          className="flex-1 font-bold"
                        />
                        <span className={`${meta.cls} text-white font-black text-xs rounded px-3 py-2`}>
                          G={nivel} · {meta.label}
                        </span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveRisco(idx, -1)}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveRisco(idx, 1)}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => removeRisco(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">Efeitos / Danos</Label>
                          <Textarea rows={2} value={r.efeitos_danos ?? ""} onChange={(e) => updateRisco(idx, { efeitos_danos: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Ações Preventivas</Label>
                          <Textarea rows={2} value={r.acoes_preventivas ?? ""} onChange={(e) => updateRisco(idx, { acoes_preventivas: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <Label className="text-xs">Probabilidade (1-3)</Label>
                          <Select value={String(r.probabilidade)} onValueChange={(v) => updateRisco(idx, { probabilidade: parseInt(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 - Baixa</SelectItem>
                              <SelectItem value="2">2 - Média</SelectItem>
                              <SelectItem value="3">3 - Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Severidade (1-3)</Label>
                          <Select value={String(r.severidade)} onValueChange={(v) => updateRisco(idx, { severidade: parseInt(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 - Baixa</SelectItem>
                              <SelectItem value="2">2 - Média</SelectItem>
                              <SelectItem value="3">3 - Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">EPIs (vírgula)</Label>
                          <Input value={(r.epis ?? []).join(", ")} onChange={(e) => updateRisco(idx, { epis: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                        </div>
                        <div>
                          <Label className="text-xs">NRs (vírgula)</Label>
                          <Input value={(r.nrs ?? []).join(", ")} onChange={(e) => updateRisco(idx, { nrs: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                        </div>
                        <div>
                          <Label className="text-xs">Responsável</Label>
                          <Input value={r.responsavel_acoes ?? ""} onChange={(e) => updateRisco(idx, { responsavel_acoes: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "assin" && (
          <div className="space-y-4 max-w-3xl">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
              <Select onValueChange={(v) => addExecutante(v)}>
                <SelectTrigger className="w-[320px]"><SelectValue placeholder="+ Adicionar executante (colaborador)..." /></SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {employees.filter((e: any) => !assinaturas.some((a) => a.employee_id === e.id && a.papel === "EXECUTANTE"))
                    .filter((e: any) => !apr.empresa_id || e.company_id === apr.empresa_id)
                    .map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} {e.cpf ? `· ${e.cpf}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={addAllExecutantesEmpresa} disabled={!apr.empresa_id}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar todos da empresa
              </Button>
              <span className="text-xs text-slate-500 ml-auto">Encarregado e TST aparecem automaticamente da aba 1</span>
            </div>

            {(["ENCARREGADO", "TST", "EXECUTANTE"] as const).map((papel) => {
              const list = assinaturas.filter((a) => a.papel === papel);
              if (list.length === 0 && papel === "EXECUTANTE") {
                return (
                  <div key={papel}>
                    <h3 className="font-bold text-sm text-slate-700 mb-2">EXECUTANTES ({list.length})</h3>
                    <div className="text-center text-slate-400 py-6 border-2 border-dashed border-slate-200 rounded-xl text-sm">
                      Adicione os colaboradores que executarão a atividade
                    </div>
                  </div>
                );
              }
              if (list.length === 0) return null;
              return (
                <div key={papel}>
                  <h3 className="font-bold text-sm text-slate-700 mb-2">{papel === "ENCARREGADO" ? "ENCARREGADO" : papel === "TST" ? "TÉCNICO DE SEGURANÇA" : `EXECUTANTES (${list.length})`}</h3>
                  <div className="space-y-2">
                    {list.map((a) => {
                      const idx = assinaturas.indexOf(a);
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-white flex items-center gap-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                            <Input value={a.nome} onChange={(e) => updateAssin(idx, { nome: e.target.value })} placeholder="Nome" className="font-medium" />
                            <Input value={a.cpf ?? ""} onChange={(e) => updateAssin(idx, { cpf: e.target.value })} placeholder="CPF" />
                            <Input value={a.funcao ?? ""} onChange={(e) => updateAssin(idx, { funcao: e.target.value })} placeholder="Função" />
                          </div>
                          <Button
                            size="sm"
                            variant={a.assinou_em ? "default" : "outline"}
                            onClick={() => toggleAssinou(idx)}
                            className={a.assinou_em ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                          >
                            {a.assinou_em ? "✓ Assinou" : "Marcar assinatura"}
                          </Button>
                          {papel === "EXECUTANTE" && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => removeAssin(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
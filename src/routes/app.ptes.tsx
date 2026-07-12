import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Files, Printer, Pencil, Trash2, X, HardHat, Clock, Link2, AlertTriangle, FileSearch, Users, Eye, ShieldCheck, UserCheck } from "lucide-react";
import { CheckCircle2, ClipboardList, Flame, Zap, Wind, Layers, IdCard, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PTE_RISCOS, PT_TIPOS } from "@/lib/constants";
import { formatDateBR } from "@/lib/utils-date";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { hasGlobalOverride, type SafetyOverride } from "@/lib/safety-overrides";
import { detectarExigenciaPTE } from "@/lib/apr-pte-rules";
import { PtPdfPreview } from "@/components/ptes/PtPdfPreview";
import { PteAtmosferaTab } from "@/components/ptes/PteAtmosferaTab";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PTE_PRECAUCOES_ALTURA,
  PTE_PRECAUCOES_ELETRICA,
  PTE_PRECAUCOES_QUENTE,
  PTE_PRECAUCOES_CARGA,
  PTE_PRECAUCOES_PINTURA,
  PTE_EPIS_1,
  PTE_EPIS_2,
  PTE_OUTROS_EPI,
  PTE_PREENCIMENTO_SNNA,
  PTE_RISCOS_POTENCIAIS,
  type PteOfficialItem,
  type PteTriValue,
} from "@/lib/pte-official-fields";

export const Route = createFileRoute("/app/ptes")({
  component: PtesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    apr_id: typeof s.apr_id === "string" ? s.apr_id : undefined,
    filter: typeof s.filter === "string" ? (s.filter as "all" | "linked" | "orphan") : undefined,
  }),
});

function PtesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/ptes" });
  const { isEditor, isAdmin, user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedAprId, setLinkedAprId] = useState<string | null>(null);
  const [previewPt, setPreviewPt] = useState<any | null>(null);
  const emptyForm = {
    data: today, risco: PTE_RISCOS[0], local: "", company_id: "", casco_id: "",
    tipo_pt: "PTE", hora_inicio: "07:00", hora_fim: "17:00",
    validade_tipo: "TURNO", validade_ate: "",
    emergencia_sem_apr: false, emergencia_justificativa: "",
    requisitante_id: "" as string,
    executantes_ids: [] as string[],
    vigia_id: "" as string,
    supervisor_entrada_id: "" as string,
    plano_equipe_resgate: "",
    plano_equipamentos: "",
    plano_hospital_referencia: "",
    plano_tempo_resposta_min: "",
    plano_meio_comunicacao: "",
    // FOR-SEG-04 — campos que só existem no PDF homologado (armazenados em `dados`)
    encarregado_nome: "" as string,
    mao_obra: "" as "" | "INTERNA" | "EXTERNA",
    area_restrita: "" as "" | "SIM" | "NAO",
    atv_movimentacao_cargas: false,
    atv_manutencao_civil: false,
    atv_gases_inflamaveis: false,
    atv_altura_telhados: false,
    atv_demolicao_escavacao: false,
    atv_eletricidade: false,
    atv_trabalho_quente: false,
    atv_local_confinado: false,
    atv_outros: false,
    outros_atividade_texto: "",
    riscos_potenciais: {} as Record<string, boolean>,
    outros_risco_texto: "",
    preenchimento_snna: {} as Record<string, PteTriValue | "">,
    outros_snna_texto: "",
    precaucao_quente: {} as Record<string, boolean>,
    teste_atmosfera_horario: "",
    teste_atmosfera_percentual: "",
    designado_liberacao: "",
    precaucao_altura: {} as Record<string, boolean>,
    precaucao_eletrica: {} as Record<string, boolean>,
    responsavel_bloqueio: "",
    // Novos blocos do PDF oficial
    precaucao_carga: {} as Record<string, boolean>,
    precaucao_pintura: {} as Record<string, boolean>,
    epis_col1: {} as Record<string, boolean>,
    epis_col2: {} as Record<string, boolean>,
    outros_epi: {} as Record<string, boolean>,
    outros_epi_texto: "",
    recomendacoes_adicionais: "",
    equipe_lista: [] as { nome: string; funcao: string }[],
    assinatura_encarregado_nome: "",
    assinatura_gerente_nome: "",
  };
  const [f, setF] = useState<any>(emptyForm);

  const { data: ptes = [] } = useQuery({
    queryKey: ["ptes"],
    queryFn: async () => (await supabase.from("ptes").select("*").order("data_emissao", { ascending: false })).data ?? [],
  });
  // Medições ativas de todas as PETs — usado pra computar badges de alerta no histórico
  const { data: medsAll = [] } = useQuery({
    queryKey: ["pte-medicoes-all"],
    queryFn: async () => (await supabase
      .from("pte_medicoes_atmosfericas")
      .select("pte_id,momento,tem_fora_limite,medido_em")
      .is("deleted_at", null)
    ).data ?? [],
  });
  // Modo strict (por empresa)
  const { data: petModoStrict = false } = useQuery({
    queryKey: ["pet-modo-strict"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("pet_modo_strict").limit(1).maybeSingle();
      return !!data?.pet_modo_strict;
    },
  });
  // Calcula alertas por PET (client-side, sem N+1)
  const petAlertas = useMemo(() => {
    const map = new Map<string, { needsEntrada: boolean; foraLimite: boolean; needsPlano: boolean }>();
    for (const p of ptes as any[]) {
      if (p.tipo_pt !== "PET") continue;
      const meds = (medsAll as any[]).filter((m) => m.pte_id === p.id);
      const temEntradaOk = meds.some((m) => m.momento === "ENTRADA" && !m.tem_fora_limite);
      const ultima = meds.sort((a, b) => +new Date(b.medido_em) - +new Date(a.medido_em))[0];
      const foraLimite = !!ultima?.tem_fora_limite;
      const plano = p.plano_resgate;
      const planoOk =
        plano && typeof plano === "object" &&
        (plano.equipe_resgate ?? "").toString().trim() !== "" &&
        (plano.equipamentos ?? "").toString().trim() !== "" &&
        (plano.hospital_referencia ?? "").toString().trim() !== "" &&
        /^\d+$/.test(String(plano.tempo_resposta_min ?? ""));
      map.set(p.id, { needsEntrada: !temEntradaOk, foraLimite, needsPlano: !planoOk });
    }
    return map;
  }, [ptes, medsAll]);
  const { data: aprsAll = [] } = useQuery({
    queryKey: ["aprs-light-for-ptes"],
    queryFn: async () => (await supabase.from("aprs").select("id,numero,atividade_descricao,casco_id,empresa_id,local").order("data_emissao", { ascending: false })).data ?? [],
  });
  const aprsMap = useMemo(() => new Map(aprsAll.map((a: any) => [a.id, a])), [aprsAll]);

  // Pré-preencher PTE a partir de uma APR (vindo do menu "Gerar PTE vinculada")
  useEffect(() => {
    const aprId = search.apr_id;
    if (!aprId || aprsAll.length === 0) return;
    const apr = aprsMap.get(aprId);
    if (!apr) return;
    (async () => {
      const { data: rs } = await supabase.from("apr_riscos").select("risco_nome,nrs").eq("apr_id", aprId);
      const det = detectarExigenciaPTE((rs ?? []) as any);
      const riscoSugerido = det.categoriaPrincipal && PTE_RISCOS.includes(det.categoriaPrincipal as any)
        ? det.categoriaPrincipal
        : (det.categoriaPrincipal ?? PTE_RISCOS[0]);
      setLinkedAprId(aprId);
      setF((cur: any) => ({
        ...cur,
        risco: riscoSugerido,
        local: apr.local ?? cur.local,
        casco_id: apr.casco_id ?? cur.casco_id,
        // Sugere tipo da PT pela categoria detectada
        tipo_pt: det.categoriaPrincipal === "NR-33 Espaço Confinado" ? "PET"
               : det.categoriaPrincipal === "NR-35 Altura" ? "PTA"
               : det.categoriaPrincipal === "NR-34 Trabalho a Quente" ? "PTQ"
               : det.categoriaPrincipal === "NR-10 Eletricidade" ? "PTEL"
               : det.categoriaPrincipal === "Içamento de Carga" ? "PTI"
               : det.categoriaPrincipal === "Pintura em Ambiente Fechado" ? "PTP"
               : cur.tipo_pt,
      }));
      toast.info(`Vinculando nova PTE à APR ${apr.numero}`);
      // limpa o search para não repetir ao voltar
      navigate({ to: "/app/ptes", search: {}, replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.apr_id, aprsAll]);
  const { data: emps = [] } = useQuery({
    queryKey: ["employees-light"],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("id,nome,matricula,company_id,role_id,nrs,status,data_aso")
          .eq("status", "ATIVO")
          .order("nome")
      ).data ?? [],
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name")).data ?? [],
  });
  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-light-for-ptes"],
    queryFn: async () => (await supabase.from("cascos").select("id,numero,nome").order("numero")).data ?? [],
  });
  const cascosMap = useMemo(() => new Map((cascos as any[]).map((c: any) => [c.id, c])), [cascos]);
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("*")).data ?? [],
  });
  const { data: exams = [] } = useQuery({
    queryKey: ["exams-all"],
    queryFn: async () => (await supabase.from("employee_exams").select("*")).data ?? [],
  });
  const { data: vaccines = [] } = useQuery({
    queryKey: ["vaccines-all"],
    queryFn: async () => (await supabase.from("employee_vaccinations").select("*")).data ?? [],
  });
  const { data: overridesAll = [] } = useQuery({
    queryKey: ["safety-overrides-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("safety_overrides").select("*").eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as SafetyOverride[];
    },
  });
  const { data: ossValidIds = new Set<string>() } = useQuery({
    queryKey: ["oss-valid-set"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("oss_emissoes")
        .select("employee_id,expira_em,status")
        .eq("status", "ASSINADO");
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (!r.expira_em || r.expira_em > nowIso) set.add(r.employee_id);
      });
      return set;
    },
  });

  const empOptions = useMemo(() => {
    const list = f.company_id ? emps.filter((e: any) => e.company_id === f.company_id) : emps;
    return list.map((e: any) => {
      const role = roles.find((r: any) => r.id === e.role_id) ?? null;
      const empExams = exams.filter((x: any) => x.employee_id === e.id);
      const empVacs = vaccines.filter((x: any) => x.employee_id === e.id);
      const empOv = overridesAll.filter((o) => o.employee_id === e.id);
      const ossOk = ossValidIds.has(e.id);
      const st = calculateSafetyStatus(e, role as any, empExams as any, empVacs as any, empOv, ossOk);
      const comp = companies.find((c: any) => c.id === e.company_id);
      return { e, st, compName: comp?.name ?? "S/ EMPRESA" };
    });
  }, [emps, roles, exams, vaccines, companies, overridesAll, ossValidIds, f.company_id]);

  const save = useMutation({
    mutationFn: async () => {
      // Validações de papéis
      if (!f.requisitante_id) {
        throw new Error("Requisitante (líder do serviço) é obrigatório.");
      }
      if (!f.executantes_ids || f.executantes_ids.length === 0) {
        throw new Error("Adicione pelo menos 1 executante.");
      }
      if (f.tipo_pt === "PET") {
        if (!f.vigia_id) throw new Error("Vigia é obrigatório em PET (Espaço Confinado — NR-33).");
        if (!f.supervisor_entrada_id) throw new Error("Supervisor de Entrada é obrigatório em PET (NR-33).");
      }

      const requisitante = emps.find((x: any) => x.id === f.requisitante_id);

      // Regra de ouro: APR obrigatória (exceto emergência justificada)
      if (!linkedAprId && !f.emergencia_sem_apr) {
        throw new Error("APR vinculada é obrigatória. Marque 'Emergência sem APR' apenas se autorizado.");
      }
      if (f.emergencia_sem_apr && (!f.emergencia_justificativa || f.emergencia_justificativa.trim().length < 10)) {
        throw new Error("Justificativa de emergência é obrigatória (mínimo 10 caracteres).");
      }

      // Calcula validade_ate conforme tipo
      let validadeAte: string | null = null;
      const baseDate = new Date(f.data + "T" + (f.hora_fim || "23:59") + ":00");
      if (f.validade_tipo === "TURNO") {
        validadeAte = baseDate.toISOString();
      } else if (f.validade_tipo === "24H") {
        validadeAte = new Date(new Date(f.data + "T" + (f.hora_inicio || "00:00") + ":00").getTime() + 24 * 3600 * 1000).toISOString();
      } else if (f.validade_tipo === "CUSTOM" && f.validade_ate) {
        validadeAte = new Date(f.validade_ate).toISOString();
      }

      // Bloqueio específico para Limpeza de Tanque (Risco Biológico) — checa TODOS os executantes
      if (f.risco?.toLowerCase().includes("tanque") || f.risco?.toLowerCase().includes("biológic")) {
        const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
        for (const exId of f.executantes_ids as string[]) {
          const exEmp = emps.find((x: any) => x.id === exId);
          if (!exEmp) continue;
          const empOv = overridesAll.filter((o) => o.employee_id === exId);
          if (hasGlobalOverride(empOv) || empOv.some((o) => o.item_key === "PTE")) continue;
          const role = roles.find((r: any) => r.id === exEmp.role_id);
          const reqVac: string[] = role?.req_vacinas ?? [];
          const empVacs = vaccines.filter((v: any) => v.employee_id === exId);
          const missing = reqVac.filter((vac) => {
            const latest = empVacs
              .filter((v: any) => v.tipo_vacina === vac)
              .sort((a: any, b: any) => +new Date(b.data_aplicacao) - +new Date(a.data_aplicacao))[0];
            if (!latest) return true;
            if (!latest.anexo_path) return true;
            if (latest.data_proxima_dose && new Date(latest.data_proxima_dose + "T00:00:00") < todayD) return true;
            return false;
          });
          if (missing.length) {
            throw new Error(`PT bloqueada — executante "${exEmp.nome}" com vacinas pendentes: ${missing.join(", ")}.`);
          }
        }
      }
      const commonPayload = {
        data: f.data, local: f.local || null, risco: f.risco,
        // Back-compat: employee_id/employee_name refletem o requisitante
        employee_id: f.requisitante_id || null,
        employee_name: requisitante?.nome ?? null,
        company_id: requisitante?.company_id ?? f.company_id ?? null,
        casco_id: f.casco_id || null,
        tipo_pt: f.tipo_pt,
        hora_inicio: f.hora_inicio || null,
        hora_fim: f.hora_fim || null,
        validade_tipo: f.validade_tipo,
        validade_ate: validadeAte,
        apr_id: linkedAprId,
        emergencia_sem_apr: f.emergencia_sem_apr,
        emergencia_justificativa: f.emergencia_sem_apr ? f.emergencia_justificativa : null,
        requisitante_id: f.requisitante_id || null,
        executantes_ids: f.executantes_ids,
        vigia_id: f.vigia_id || null,
        supervisor_entrada_id: f.supervisor_entrada_id || null,
        emitente_user_id: user?.id ?? null,
        plano_resgate: f.tipo_pt === "PET" ? {
          equipe_resgate: (f.plano_equipe_resgate ?? "").trim() || null,
          equipamentos: (f.plano_equipamentos ?? "").trim() || null,
          hospital_referencia: (f.plano_hospital_referencia ?? "").trim() || null,
          tempo_resposta_min: /^\d+$/.test(String(f.plano_tempo_resposta_min ?? "")) ? String(f.plano_tempo_resposta_min).trim() : null,
          meio_comunicacao: (f.plano_meio_comunicacao ?? "").trim() || null,
        } : null,
      };
      // FOR-SEG-04 — campos do PDF homologado (não têm coluna própria, ficam em `dados`)
      const dadosPdf = {
        encarregado_nome: (f.encarregado_nome ?? "").trim() || null,
        mao_obra: f.mao_obra || null,
        area_restrita: f.area_restrita === "SIM" ? true : f.area_restrita === "NAO" ? false : null,
        atividades: {
          movimentacao_cargas: !!f.atv_movimentacao_cargas,
          manutencao_civil: !!f.atv_manutencao_civil,
          gases_inflamaveis: !!f.atv_gases_inflamaveis,
          altura_telhados: !!f.atv_altura_telhados,
          demolicao_escavacao: !!f.atv_demolicao_escavacao,
          eletricidade: !!f.atv_eletricidade,
          trabalho_quente: !!f.atv_trabalho_quente,
          local_confinado: !!f.atv_local_confinado,
          outros: !!f.atv_outros,
        },
        outros_atividade_texto: (f.outros_atividade_texto ?? "").trim() || null,
        riscos_potenciais: f.riscos_potenciais ?? {},
        outros_risco_texto: (f.outros_risco_texto ?? "").trim() || null,
        preenchimento_snna: f.preenchimento_snna ?? {},
        outros_snna_texto: (f.outros_snna_texto ?? "").trim() || null,
        precaucao_quente: f.precaucao_quente ?? {},
        teste_atmosfera_horario: (f.teste_atmosfera_horario ?? "").trim() || null,
        teste_atmosfera_percentual: (f.teste_atmosfera_percentual ?? "").trim() || null,
        designado_liberacao: (f.designado_liberacao ?? "").trim() || null,
        precaucao_altura: f.precaucao_altura ?? {},
        precaucao_eletrica: f.precaucao_eletrica ?? {},
        responsavel_bloqueio: (f.responsavel_bloqueio ?? "").trim() || null,
        precaucao_carga: f.precaucao_carga ?? {},
        precaucao_pintura: f.precaucao_pintura ?? {},
        epis_col1: f.epis_col1 ?? {},
        epis_col2: f.epis_col2 ?? {},
        outros_epi: f.outros_epi ?? {},
        outros_epi_texto: (f.outros_epi_texto ?? "").trim() || null,
        recomendacoes_adicionais: (f.recomendacoes_adicionais ?? "").trim() || null,
        equipe_lista: (f.equipe_lista ?? []).filter((r: any) => r && (r.nome?.trim() || r.funcao?.trim())),
        assinatura_encarregado_nome: (f.assinatura_encarregado_nome ?? "").trim() || null,
        assinatura_gerente_nome: (f.assinatura_gerente_nome ?? "").trim() || null,
      };

      if (editingId) {
        // Reemissão: ao atualizar, considera como nova emissão (zera o "envelhecimento" de 7 dias)
        const { error } = await supabase
          .from("ptes")
          .update({ ...commonPayload, data_emissao: new Date().toISOString(), dados: dadosPdf })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const numero = `${f.tipo_pt}-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const { error } = await supabase.from("ptes").insert({ ...commonPayload, numero, status: "ATIVA", dados: dadosPdf });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ptes"] });
      qc.invalidateQueries({ queryKey: ["ptes-by-apr"] });
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return k === "ptes-linked-apr" || k === "ptes-light";
      } });
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey?.[0] === "string" && (q.queryKey[0] as string).startsWith("pend-") });
      setEditingId(null);
      setLinkedAprId(null);
      setF(emptyForm);
      toast.success(editingId ? "Permissão atualizada" : "Permissão emitida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ptes").update({ status: "ENCERRADA" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return k === "ptes" || k === "ptes-by-apr" || k === "ptes-linked-apr" || k === "ptes-light";
      } });
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey?.[0] === "string" && (q.queryKey[0] as string).startsWith("pend-") });
      toast.success("PTE encerrada");
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ptes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return k === "ptes" || k === "ptes-by-apr" || k === "ptes-linked-apr" || k === "ptes-light";
      } });
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey?.[0] === "string" && (q.queryKey[0] as string).startsWith("pend-") });
      toast.success("Removido");
    },
  });

  function startEdit(p: any) {
    setEditingId(p.id);
    setLinkedAprId(p.apr_id ?? null);
    const pr = (p.plano_resgate ?? {}) as any;
    const d = (p.dados ?? {}) as any;
    const atv = (d.atividades ?? {}) as any;
    setF({
      data: p.data,
      risco: p.risco ?? PTE_RISCOS[0],
      local: p.local ?? "",
      company_id: p.company_id ?? "",
      casco_id: p.casco_id ?? "",
      tipo_pt: p.tipo_pt ?? "PTE",
      hora_inicio: p.hora_inicio ?? "07:00",
      hora_fim: p.hora_fim ?? "17:00",
      validade_tipo: p.validade_tipo ?? "TURNO",
      validade_ate: p.validade_ate ? new Date(p.validade_ate).toISOString().slice(0, 16) : "",
      emergencia_sem_apr: p.emergencia_sem_apr ?? false,
      emergencia_justificativa: p.emergencia_justificativa ?? "",
      requisitante_id: p.requisitante_id ?? p.employee_id ?? "",
      executantes_ids: (p.executantes_ids as string[] | null) ?? (p.employee_id ? [p.employee_id] : []),
      vigia_id: p.vigia_id ?? "",
      supervisor_entrada_id: p.supervisor_entrada_id ?? "",
      plano_equipe_resgate: pr.equipe_resgate ?? "",
      plano_equipamentos: pr.equipamentos ?? "",
      plano_hospital_referencia: pr.hospital_referencia ?? "",
      plano_tempo_resposta_min: pr.tempo_resposta_min ?? "",
      plano_meio_comunicacao: pr.meio_comunicacao ?? "",
      encarregado_nome: d.encarregado_nome ?? "",
      mao_obra: d.mao_obra ?? "",
      area_restrita: d.area_restrita === true ? "SIM" : d.area_restrita === false ? "NAO" : "",
      atv_movimentacao_cargas: !!atv.movimentacao_cargas,
      atv_manutencao_civil: !!atv.manutencao_civil,
      atv_gases_inflamaveis: !!atv.gases_inflamaveis,
      atv_altura_telhados: !!atv.altura_telhados,
      atv_demolicao_escavacao: !!atv.demolicao_escavacao,
      atv_eletricidade: !!atv.eletricidade,
      atv_trabalho_quente: !!atv.trabalho_quente,
      atv_local_confinado: !!atv.local_confinado,
      atv_outros: !!atv.outros,
      outros_atividade_texto: d.outros_atividade_texto ?? "",
      riscos_potenciais: d.riscos_potenciais ?? {},
      outros_risco_texto: d.outros_risco_texto ?? "",
      preenchimento_snna: d.preenchimento_snna ?? {},
      outros_snna_texto: d.outros_snna_texto ?? "",
      precaucao_quente: d.precaucao_quente ?? {},
      teste_atmosfera_horario: d.teste_atmosfera_horario ?? "",
      teste_atmosfera_percentual: d.teste_atmosfera_percentual ?? "",
      designado_liberacao: d.designado_liberacao ?? "",
      precaucao_altura: d.precaucao_altura ?? {},
      precaucao_eletrica: d.precaucao_eletrica ?? {},
      responsavel_bloqueio: d.responsavel_bloqueio ?? "",
      precaucao_carga: d.precaucao_carga ?? {},
      precaucao_pintura: d.precaucao_pintura ?? {},
      epis_col1: d.epis_col1 ?? {},
      epis_col2: d.epis_col2 ?? {},
      outros_epi: d.outros_epi ?? {},
      outros_epi_texto: d.outros_epi_texto ?? "",
      recomendacoes_adicionais: d.recomendacoes_adicionais ?? "",
      equipe_lista: Array.isArray(d.equipe_lista) ? d.equipe_lista : [],
      assinatura_encarregado_nome: d.assinatura_encarregado_nome ?? "",
      assinatura_gerente_nome: d.assinatura_gerente_nome ?? "",
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setLinkedAprId(null);
    setF(emptyForm);
  }

  function setPdfFlag(group: string, key: string, value: boolean) {
    setF((cur: any) => ({ ...cur, [group]: { ...(cur[group] ?? {}), [key]: value } }));
  }

  function setPdfAnswer(group: string, key: string, value: PteTriValue) {
    setF((cur: any) => ({
      ...cur,
      [group]: {
        ...(cur[group] ?? {}),
        [key]: cur[group]?.[key] === value ? "" : value,
      },
    }));
  }

  // Wizard horizontal — abas/pills
  const [activeStep, setActiveStep] = useState<string>("ident");
  const stepChecks = useMemo(() => ({
    ident: !!(f.tipo_pt && f.local && f.data && (linkedAprId || f.emergencia_sem_apr)),
    equipe: !!(f.requisitante_id && (f.executantes_ids?.length ?? 0) > 0 &&
      (f.tipo_pt !== "PET" || (f.vigia_id && f.supervisor_entrada_id))),
    atividades: Object.entries(f).some(([k, v]) => k.startsWith("atv_") && v) || !!f.mao_obra || !!f.area_restrita,
    riscos: Object.values(f.riscos_potenciais ?? {}).some(Boolean),
    snna: Object.values(f.preenchimento_snna ?? {}).some((v) => v === "S" || v === "N" || v === "NA"),
    precaucoes: Object.values(f.precaucao_quente ?? {}).some(Boolean) ||
      Object.values(f.precaucao_altura ?? {}).some(Boolean) ||
      Object.values(f.precaucao_eletrica ?? {}).some(Boolean),
    pet: f.tipo_pt !== "PET" || !!(f.plano_equipe_resgate && f.plano_equipamentos && f.plano_hospital_referencia && f.plano_tempo_resposta_min),
  }), [f, linkedAprId]);
  const STEPS = [
    { id: "ident", label: "Identificação", icon: IdCard },
    { id: "equipe", label: "Equipe", icon: Users },
    { id: "atividades", label: "Atividades", icon: ClipboardList },
    { id: "riscos", label: "Riscos", icon: AlertTriangle },
    { id: "snna", label: "S / N / NA", icon: CheckCircle2 },
    { id: "precaucoes", label: "Precauções", icon: ShieldCheck },
    { id: "cargas_pintura", label: "Cargas & Pintura", icon: HardHat },
    { id: "epis", label: "EPIs", icon: ShieldCheck },
    { id: "assinaturas", label: "Equipe & Assinaturas", icon: UserCheck },
    ...(f.tipo_pt === "PET" ? [{ id: "pet", label: "PET / Resgate", icon: Wind }] : []),
    { id: "revisao", label: "Revisão", icon: Sparkles },
  ] as { id: string; label: string; icon: any }[];
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === activeStep));
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const goPrev = () => !isFirst && setActiveStep(STEPS[stepIndex - 1].id);
  const goNext = () => !isLast && setActiveStep(STEPS[stepIndex + 1].id);

  function PdfCheckboxGroup({ title, group, items }: { title: string; group: string; items: readonly PteOfficialItem[] }) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider block">{title}</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((o) => (
            <label key={o.key} className={`flex items-start gap-2 text-[11px] leading-snug font-bold normal-case rounded-xl px-3 py-2 cursor-pointer transition-all border ${
              f[group]?.[o.key]
                ? "bg-lime-500/15 text-lime-50 border-lime-400/50 shadow-[0_0_12px_-6px_rgba(163,230,53,0.6)]"
                : "bg-white/[0.04] text-slate-100 border-white/10 hover:border-amber-400/40 hover:bg-white/[0.07]"
            }`}>
              <Checkbox
                checked={!!f[group]?.[o.key]}
                onCheckedChange={(v) => setPdfFlag(group, o.key, !!v)}
                className="mt-0.5"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  function PdfAnswerGroup({ title, group, items }: { title: string; group: string; items: readonly PteOfficialItem[] }) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider block">{title}</Label>
        <div className="grid grid-cols-1 gap-2">
          {items.map((o) => (
            <div key={o.key} className="grid grid-cols-[1fr_auto] gap-3 items-center text-[11px] leading-snug font-bold normal-case text-slate-100 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2">
              <span>{o.label}</span>
              <div className="flex gap-1">
                {(["S", "N", "NA"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPdfAnswer(group, o.key, v)}
                    className={`h-8 min-w-[36px] px-2 rounded-lg border text-[11px] font-black tracking-wider transition-all ${
                      f[group]?.[o.key] === v
                        ? v === "S"
                          ? "bg-lime-500 text-slate-900 border-lime-300 shadow-[0_0_12px_-4px_rgba(163,230,53,0.9)]"
                          : v === "N"
                            ? "bg-rose-500 text-white border-rose-300 shadow-[0_0_12px_-4px_rgba(244,63,94,0.8)]"
                            : "bg-amber-400 text-slate-900 border-amber-200 shadow-[0_0_12px_-4px_rgba(251,191,36,0.8)]"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-slate-100"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-fadeIn h-full overflow-y-auto custom-scrollbar">
      <div className="mb-6 md:mb-8">
        <h2 className="heading-display text-2xl md:text-4xl text-rose-100 drop-shadow-[0_2px_12px_rgba(220,38,70,0.45)]">
          Permissões de Trabalho
        </h2>
        <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-200/80 mt-1">
          PT • PTE • PET • emissão, validade e impressão
        </p>
      </div>

      <div className="flex flex-col gap-6 md:gap-8">
        {/* FORM — WIZARD HORIZONTAL */}
        <div className="glass-card glass-shine rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-600/80 to-amber-500/70 flex items-center justify-center shadow-[0_0_18px_-2px_rgba(245,158,11,0.55)]">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-black text-rose-100 uppercase tracking-widest">
                  {editingId ? "Editar Permissão" : "Nova Permissão de Trabalho"}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-300/70">
                  Passo {stepIndex + 1} de {STEPS.length} · {STEPS[stepIndex]?.label}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> {f.tipo_pt}
              </span>
              {linkedAprId && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-lime-500/15 text-lime-200 border border-lime-400/30 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> APR
                </span>
              )}
              {f.emergencia_sem_apr && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/40 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Emergência
                </span>
              )}
              {editingId && (
                <button type="button" onClick={cancelEdit} className="text-[10px] bg-black/40 text-rose-200 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-black/60 uppercase font-black">
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)] gap-4 lg:gap-6">
            {/* RAIL VERTICAL DE PASSOS */}
            <aside className="lg:sticky lg:top-4 lg:self-start">
              {/* Mobile: seletor compacto horizontal com scroll */}
              <div className="lg:hidden -mx-1 overflow-x-auto custom-scrollbar mb-2">
                <div className="flex items-center gap-1.5 px-1 min-w-max">
                  {STEPS.map((s, i) => {
                    const active = s.id === activeStep;
                    const done = (stepChecks as any)[s.id] === true;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveStep(s.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider border transition-all whitespace-nowrap ${
                          active
                            ? "bg-amber-300 text-slate-900 border-amber-200"
                            : done
                              ? "bg-lime-500/15 text-lime-100 border-lime-400/40"
                              : "bg-white/[0.05] text-slate-200 border-white/10"
                        }`}
                      >
                        <span className="h-4 w-4 rounded-full bg-black/20 flex items-center justify-center text-[9px]">
                          {done && !active ? <CheckCircle2 className="h-2.5 w-2.5" /> : i + 1}
                        </span>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Desktop: rail vertical */}
              <ol className="hidden lg:flex flex-col gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-2">
                {STEPS.map((s, i) => {
                  const active = s.id === activeStep;
                  const done = (stepChecks as any)[s.id] === true;
                  const Icon = s.icon;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveStep(s.id)}
                        className={`w-full flex items-center gap-2 rounded-lg pl-2 pr-3 py-2 text-[11px] font-bold tracking-wide transition-all border ${
                          active
                            ? "bg-gradient-to-r from-amber-300/95 to-lime-400/95 text-slate-900 border-amber-200 shadow-[0_0_16px_-6px_rgba(245,158,11,0.9)]"
                            : done
                              ? "bg-lime-500/10 text-lime-100 border-lime-400/25 hover:bg-lime-500/20"
                              : "bg-transparent text-slate-200 border-transparent hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <span className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black ${
                          active ? "bg-slate-900/25 text-slate-900" : done ? "bg-lime-400/30 text-lime-50" : "bg-white/10 text-slate-100"
                        }`}>
                          {done && !active ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                        </span>
                        <Icon className="h-3.5 w-3.5 opacity-80" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="hidden lg:flex mt-2 items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300/70 px-1">
                <span>Progresso</span>
                <span className="text-lime-200">{Object.values(stepChecks).filter(Boolean).length}/{STEPS.length - 1}</span>
              </div>
            </aside>

            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5 min-w-0">
          <div hidden={activeStep !== "ident"} className="space-y-6">

            {/* TIPO DA PT */}
            <div>
              <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Tipo de Permissão</Label>
              <Select value={f.tipo_pt} onValueChange={(v) => setF({ ...f, tipo_pt: v })}>
                <SelectTrigger className="bg-black/30 border-white/10 text-rose-50 mt-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PT_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label} <span className="text-[9px] text-slate-400 ml-1">({t.nr})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* APR VINCULADA — OBRIGATÓRIA */}
            <div className="rounded-xl p-4 bg-gradient-to-br from-rose-950/60 to-black/40 border border-rose-500/20 shadow-[inset_0_1px_0_rgba(255,230,235,0.05)]">
              <Label className="text-[10px] font-black text-rose-200 uppercase flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4" /> APR Vinculada {!f.emergencia_sem_apr && <span className="text-red-600">*</span>}
              </Label>
              <Select
                value={linkedAprId ?? "none"}
                disabled={f.emergencia_sem_apr}
                onValueChange={(v) => {
                  if (v === "none") { setLinkedAprId(null); return; }
                  setLinkedAprId(v);
                  const apr = aprsMap.get(v) as any;
                  if (apr) setF((cur: any) => ({ ...cur, local: apr.local ?? cur.local, casco_id: apr.casco_id ?? cur.casco_id }));
                }}
              >
                <SelectTrigger className="bg-black/40 border-white/10 text-rose-50 text-xs font-bold uppercase">
                  <SelectValue placeholder="-- SELECIONE A APR --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— SEM APR —</SelectItem>
                  {(aprsAll as any[]).slice(0, 200).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>APR {a.numero} — {a.atividade_descricao?.slice(0, 50) ?? ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <div className="mt-3 flex items-start gap-2">
                  <Checkbox
                    id="emerg"
                    checked={f.emergencia_sem_apr}
                    onCheckedChange={(v) => setF({ ...f, emergencia_sem_apr: !!v })}
                  />
                  <div className="flex-1">
                    <label htmlFor="emerg" className="text-[10px] font-black text-amber-300 uppercase cursor-pointer flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Emergência — emitir sem APR (apenas Admin)
                    </label>
                    {f.emergencia_sem_apr && (
                      <Textarea
                        required
                        value={f.emergencia_justificativa}
                        onChange={(e) => setF({ ...f, emergencia_justificativa: e.target.value })}
                        placeholder="Justificativa obrigatória (mínimo 10 caracteres) — será registrada em auditoria"
                        className="mt-2 bg-black/40 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs"
                        rows={2}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {linkedAprId && !f.emergencia_sem_apr && (
              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
                <Link2 className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                <div className="flex-1 text-[10px] font-bold uppercase text-amber-100">
                  Vinculando à APR {(aprsMap.get(linkedAprId) as any)?.numero ?? linkedAprId.slice(0, 8)}
                  <button type="button" onClick={() => setLinkedAprId(null)} className="ml-2 text-amber-300 underline">remover vínculo</button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Local do Trabalho / Instalação</Label>
              <Input required value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} placeholder="Ex: Dique Seco, Navio XYZ..." className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 mt-2 text-xs font-bold uppercase" />
            </div>
            <div>
              <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Encarregado (PDF FOR-SEG-04)</Label>
              <Input value={f.encarregado_nome} onChange={(e) => setF({ ...f, encarregado_nome: e.target.value })} placeholder="Nome do encarregado responsável" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 mt-2 text-xs font-bold uppercase" />
              <p className="text-[9px] text-slate-300/60 mt-1 uppercase">Se vazio, usa o requisitante no PDF.</p>
            </div>
            <div>
              <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Frente de Trabalho (Casco)</Label>
              <Select value={f.casco_id || "none"} onValueChange={(v) => setF({ ...f, casco_id: v === "none" ? "" : v })}>
                <SelectTrigger className="bg-black/30 border-white/10 text-rose-50 mt-2 text-xs font-bold uppercase">
                  <SelectValue placeholder="-- SELECIONE O CASCO --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— SEM CASCO —</SelectItem>
                  {(cascos as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      CASCO {c.numero}{c.nome ? ` — ${c.nome}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Classificação de Risco (GSI)</Label>
              <Select value={f.risco} onValueChange={(v) => setF({ ...f, risco: v })}>
                <SelectTrigger className="bg-black/30 border-white/10 text-rose-50 mt-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>{PTE_RISCOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* DATA + HORÁRIOS */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Data</Label>
                <Input type="date" required value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className="bg-black/30 border-white/10 text-rose-50 mt-2" />
              </div>
              <div>
                <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Início</Label>
                <Input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} className="bg-black/30 border-white/10 text-rose-50 mt-2" />
              </div>
              <div>
                <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Fim</Label>
                <Input type="time" value={f.hora_fim} onChange={(e) => setF({ ...f, hora_fim: e.target.value })} className="bg-black/30 border-white/10 text-rose-50 mt-2" />
              </div>
            </div>

            {/* VALIDADE */}
            <div>
              <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider mb-2 block">Validade</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "TURNO", l: "Turno" },
                  { v: "24H", l: "24h" },
                  { v: "CUSTOM", l: "Personalizada" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setF({ ...f, validade_tipo: opt.v })}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                      f.validade_tipo === opt.v
                        ? "bg-gradient-to-br from-rose-600/90 to-rose-900/90 text-rose-50 border-rose-400/40 shadow-[0_0_20px_-4px_rgba(220,38,70,0.7)]"
                        : "bg-black/30 text-slate-200/90 border-white/10 hover:bg-black/50 hover:text-rose-100"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {f.validade_tipo === "CUSTOM" && (
                <Input
                  type="datetime-local"
                  value={f.validade_ate}
                  onChange={(e) => setF({ ...f, validade_ate: e.target.value })}
                  className="bg-black/30 border-white/10 text-rose-50 mt-2"
                />
              )}
            </div>
          </div>

          <div hidden={activeStep !== "equipe"} className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-black/40 to-rose-950/30 border border-white/10 shadow-[inset_0_1px_0_rgba(255,230,235,0.05)] space-y-5">
              <div>
                <Label className="text-[10px] font-black text-rose-100 uppercase flex items-center gap-2 mb-3">
                  <HardHat className="h-4 w-4" /> Empresa (filtro)
                </Label>
                <Select
                  value={f.company_id || "none"}
                  onValueChange={(v) => setF({ ...f, company_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-rose-50 text-xs font-bold uppercase">
                    <SelectValue placeholder="-- TODAS AS EMPRESAS --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— TODAS AS EMPRESAS —</SelectItem>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* REQUISITANTE */}
              <div>
                <Label className="text-[10px] font-black text-rose-100 uppercase flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4" /> Requisitante <span className="text-red-600">*</span>
                  <span className="text-[9px] font-bold text-slate-300/70 normal-case">(líder/encarregado do serviço)</span>
                </Label>
                <select
                  required
                  value={f.requisitante_id}
                  onChange={(e) => setF({ ...f, requisitante_id: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 text-rose-50 rounded-xl px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400/40"
                >
                  <option value="">-- SELECIONE O REQUISITANTE --</option>
                  {empOptions.map(({ e, st, compName }) => {
                    const blocked = !st.acessoPermitido;
                    return (
                      <option
                        key={e.id}
                        value={e.id}
                        disabled={blocked && f.requisitante_id !== e.id}
                        style={{ color: blocked ? "#9f1239" : "#0f172a", background: "#fff" }}
                      >
                        {blocked ? "🚫" : "✅"} {e.nome} - [{compName}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* EXECUTANTES (multi) */}
              <div>
                <Label className="text-[10px] font-black text-rose-100 uppercase flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4" /> Executantes <span className="text-red-600">*</span>
                  <span className="text-[9px] font-bold text-slate-300/70 normal-case">(equipe que executa)</span>
                </Label>
                {f.executantes_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(f.executantes_ids as string[]).map((eid) => {
                      const emp = emps.find((e: any) => e.id === eid);
                      return (
                        <span key={eid} className="inline-flex items-center gap-1 bg-rose-950/70 text-rose-100 border border-rose-500/30 text-[10px] font-black uppercase px-2 py-1 rounded">
                          {emp?.nome ?? "?"}
                          <button type="button" onClick={() => setF({ ...f, executantes_ids: f.executantes_ids.filter((x: string) => x !== eid) })} className="hover:text-red-400">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    if (f.executantes_ids.includes(e.target.value)) return;
                    setF({ ...f, executantes_ids: [...f.executantes_ids, e.target.value] });
                  }}
                  className="w-full bg-black/40 border border-white/10 text-rose-50 rounded-xl px-4 py-2.5 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400/40"
                >
                  <option value="">+ ADICIONAR EXECUTANTE</option>
                  {empOptions
                    .filter(({ e }) => !f.executantes_ids.includes(e.id))
                    .map(({ e, st, compName }) => (
                      <option
                        key={e.id}
                        value={e.id}
                        disabled={!st.acessoPermitido}
                        style={{ color: st.acessoPermitido ? "#0f172a" : "#9f1239", background: "#fff" }}
                      >
                        {st.acessoPermitido ? "✅" : "🚫"} {e.nome} - [{compName}]
                      </option>
                    ))}
                </select>
              </div>

              {/* VIGIA + SUPERVISOR (apenas PET / NR-33) */}
              {f.tipo_pt === "PET" && (
                <>
                  <div>
                    <Label className="text-[10px] font-black text-amber-300 uppercase flex items-center gap-2 mb-2">
                      <Eye className="h-4 w-4" /> Vigia (NR-33) <span className="text-red-600">*</span>
                    </Label>
                    <select
                      required
                      value={f.vigia_id}
                      onChange={(e) => setF({ ...f, vigia_id: e.target.value })}
                      className="w-full bg-black/40 border border-amber-500/30 text-rose-50 rounded-xl px-4 py-2.5 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400/50"
                    >
                      <option value="">-- SELECIONE O VIGIA --</option>
                      {empOptions.map(({ e, compName }) => (
                        <option key={e.id} value={e.id}>{e.nome} - [{compName}]</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black text-amber-300 uppercase flex items-center gap-2 mb-2">
                      <ShieldCheck className="h-4 w-4" /> Supervisor de Entrada (NR-33) <span className="text-red-600">*</span>
                    </Label>
                    <select
                      required
                      value={f.supervisor_entrada_id}
                      onChange={(e) => setF({ ...f, supervisor_entrada_id: e.target.value })}
                      className="w-full bg-black/40 border border-amber-500/30 text-rose-50 rounded-xl px-4 py-2.5 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400/50"
                    >
                      <option value="">-- SELECIONE O SUPERVISOR --</option>
                      {empOptions.map(({ e, compName }) => (
                        <option key={e.id} value={e.id}>{e.nome} - [{compName}]</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="text-[9px] font-bold uppercase text-slate-200/80 bg-black/30 border border-dashed border-white/10 rounded-lg px-3 py-2">
                Emitente: <span className="text-rose-100 font-black">{user?.email ?? "—"}</span> (usuário logado)
              </div>
            </div>
          </div>

          {/* ATIVIDADES */}
          <div hidden={activeStep !== "atividades"} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-rose-950/30 p-5 space-y-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-100 border-b border-white/10 pb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-300" /> Descrição das atividades (FOR-SEG-04)
              </h3>
              <div className="space-y-2">
                <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider block">Descrição das atividades a serem executadas</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { k: "atv_movimentacao_cargas", l: "Movimentação de cargas" },
                    { k: "atv_manutencao_civil", l: "Manutenção civil" },
                    { k: "atv_gases_inflamaveis", l: "Gases inflamáveis" },
                    { k: "atv_altura_telhados", l: "Altura / telhados" },
                    { k: "atv_demolicao_escavacao", l: "Demolição / escavação" },
                    { k: "atv_eletricidade", l: "Eletricidade" },
                    { k: "atv_trabalho_quente", l: "Trabalho a quente" },
                    { k: "atv_local_confinado", l: "Local confinado" },
                    { k: "atv_outros", l: "Outros" },
                  ].map((o) => (
                    <label key={o.k} className="flex items-center gap-2 text-[10px] font-bold uppercase text-rose-100 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 cursor-pointer hover:border-rose-500/40">
                      <Checkbox checked={!!(f as any)[o.k]} onCheckedChange={(v) => setF({ ...f, [o.k]: !!v })} />
                      {o.l}
                    </label>
                  ))}
                </div>
                {f.atv_outros && (
                  <Input value={f.outros_atividade_texto} onChange={(e) => setF({ ...f, outros_atividade_texto: e.target.value })} placeholder="Descreva outros" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider mb-2 block">Mão de obra</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ v: "INTERNA", l: "Interna" }, { v: "EXTERNA", l: "Externa" }].map((o) => (
                      <button key={o.v} type="button" onClick={() => setF({ ...f, mao_obra: f.mao_obra === o.v ? "" : o.v })} className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${f.mao_obra === o.v ? "bg-gradient-to-br from-rose-600/90 to-rose-900/90 text-rose-50 border-rose-400/40" : "bg-black/30 text-slate-200/90 border-white/10 hover:bg-black/50"}`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider mb-2 block">Área restrita</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ v: "SIM", l: "Sim" }, { v: "NAO", l: "Não" }].map((o) => (
                      <button key={o.v} type="button" onClick={() => setF({ ...f, area_restrita: f.area_restrita === o.v ? "" : o.v })} className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${f.area_restrita === o.v ? "bg-gradient-to-br from-rose-600/90 to-rose-900/90 text-rose-50 border-rose-400/40" : "bg-black/30 text-slate-200/90 border-white/10 hover:bg-black/50"}`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RISCOS */}
          <div hidden={activeStep !== "riscos"} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-rose-950/30 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-100 border-b border-white/10 pb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> Riscos potenciais
              </h3>
              <PdfCheckboxGroup title="Marque os que se aplicam" group="riscos_potenciais" items={PTE_RISCOS_POTENCIAIS} />
              {f.riscos_potenciais?.outros && (
                <Input value={f.outros_risco_texto} onChange={(e) => setF({ ...f, outros_risco_texto: e.target.value })} placeholder="Outros riscos" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
              )}
            </div>
          </div>

          {/* S/N/NA */}
          <div hidden={activeStep !== "snna"} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-rose-950/30 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-100 border-b border-white/10 pb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-lime-300" /> Preenchimento — S / N / NA
              </h3>
              <PdfAnswerGroup title="(S) Sim · (N) Não · (NA) Não Aplicável" group="preenchimento_snna" items={PTE_PREENCIMENTO_SNNA} />
              {f.preenchimento_snna?.outros && (
                <Input value={f.outros_snna_texto} onChange={(e) => setF({ ...f, outros_snna_texto: e.target.value })} placeholder="Outros" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
              )}
            </div>
          </div>

          {/* PRECAUÇÕES */}
          <div hidden={activeStep !== "precaucoes"} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-rose-950/30 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-100 border-b border-white/10 pb-2 flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-300" /> Trabalho a Quente
              </h3>
              <PdfCheckboxGroup title="Precauções" group="precaucao_quente" items={PTE_PRECAUCOES_QUENTE} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input value={f.teste_atmosfera_horario} onChange={(e) => setF({ ...f, teste_atmosfera_horario: e.target.value })} placeholder="Horário teste atmosfera" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
                <Input value={f.teste_atmosfera_percentual} onChange={(e) => setF({ ...f, teste_atmosfera_percentual: e.target.value })} placeholder="Concentração %" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
                <Input value={f.designado_liberacao} onChange={(e) => setF({ ...f, designado_liberacao: e.target.value })} placeholder="Designado pela liberação" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-rose-950/30 p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-100 border-b border-white/10 pb-2 flex items-center gap-2">
                <Layers className="h-4 w-4 text-lime-300" /> Trabalho em Altura
              </h3>
              <PdfCheckboxGroup title="Precauções" group="precaucao_altura" items={PTE_PRECAUCOES_ALTURA} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-rose-950/30 p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-100 border-b border-white/10 pb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-300" /> Eletricidade / Fonte de Energia
              </h3>
              <PdfCheckboxGroup title="Precauções" group="precaucao_eletrica" items={PTE_PRECAUCOES_ELETRICA} />
              <Input value={f.responsavel_bloqueio} onChange={(e) => setF({ ...f, responsavel_bloqueio: e.target.value })} placeholder="Responsável pelo bloqueio" className="bg-black/30 border-white/10 text-rose-50 placeholder:text-slate-400/70 text-xs font-bold uppercase" />
              <p className="text-[9px] font-bold uppercase text-slate-300/60">
                Fim de semana / feriado é preenchido automaticamente no PDF conforme a data selecionada.
              </p>
            </div>
          </div>

          {/* CARGAS & PINTURA */}
          <div hidden={activeStep !== "cargas_pintura"} className="space-y-6">
            <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-500/5 via-black/40 to-black/40 p-5 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-100 border-b border-amber-300/20 pb-2 flex items-center gap-2">
                <HardHat className="h-4 w-4 text-amber-300" /> Movimentação e Içamento de Carga
              </h3>
              <PdfCheckboxGroup title="Precauções" group="precaucao_carga" items={PTE_PRECAUCOES_CARGA} />
            </div>
            <div className="rounded-2xl border border-lime-300/25 bg-gradient-to-br from-lime-500/5 via-black/40 to-black/40 p-5 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-lime-100 border-b border-lime-300/20 pb-2 flex items-center gap-2">
                <Wind className="h-4 w-4 text-lime-300" /> Trabalho com Pintura
              </h3>
              <PdfCheckboxGroup title="Precauções" group="precaucao_pintura" items={PTE_PRECAUCOES_PINTURA} />
            </div>
          </div>

          {/* EPIs */}
          <div hidden={activeStep !== "epis"} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-black/40 p-5 space-y-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-50 border-b border-white/10 pb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-300" /> Equipamentos de Proteção Individual Obrigatórios
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-200 bg-amber-400/10 border border-amber-300/30 rounded-full px-3 py-1 inline-block">EPI · Coluna 1</div>
                  <PdfCheckboxGroup title="Óculos · Capacetes · Respiradores · Botas" group="epis_col1" items={PTE_EPIS_1} />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-lime-200 bg-lime-400/10 border border-lime-300/30 rounded-full px-3 py-1 inline-block">EPI · Coluna 2</div>
                  <PdfCheckboxGroup title="Aventais · Mangotes · Macacões · Luvas" group="epis_col2" items={PTE_EPIS_2} />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-100 bg-white/10 border border-white/20 rounded-full px-3 py-1 inline-block">Outros / Coletivos</div>
                  <PdfCheckboxGroup title="Sinalização · Isolamentos · Coletivos" group="outros_epi" items={PTE_OUTROS_EPI} />
                  {f.outros_epi?.outros && (
                    <Input
                      value={f.outros_epi_texto}
                      onChange={(e) => setF({ ...f, outros_epi_texto: e.target.value })}
                      placeholder="Descreva outros EPIs"
                      className="bg-white/[0.05] border-white/15 text-slate-50 placeholder:text-slate-400 text-xs font-bold"
                    />
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Recomendações adicionais de segurança</Label>
                <Textarea
                  value={f.recomendacoes_adicionais}
                  onChange={(e) => setF({ ...f, recomendacoes_adicionais: e.target.value })}
                  placeholder="Ex.: manter a área ventilada, comunicar mudanças ao TST, reavaliar a cada 2h..."
                  className="bg-white/[0.05] border-white/15 text-slate-50 placeholder:text-slate-400 text-sm min-h-[90px]"
                />
              </div>
            </div>
          </div>

          {/* EQUIPE & ASSINATURAS */}
          <div hidden={activeStep !== "assinaturas"} className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-black/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-50 flex items-center gap-2">
                  <Users className="h-4 w-4 text-lime-300" /> Equipe — Nome, Função e Assinatura
                </h3>
                <button
                  type="button"
                  onClick={() => setF({ ...f, equipe_lista: [...(f.equipe_lista ?? []), { nome: "", funcao: "" }] })}
                  className="text-[11px] font-black uppercase tracking-wider rounded-full px-3 py-1.5 bg-lime-400 text-slate-900 hover:bg-lime-300 border border-lime-200 shadow-[0_0_14px_-4px_rgba(163,230,53,0.9)]"
                >
                  + Adicionar linha
                </button>
              </div>
              <p className="text-[11px] text-slate-300/80 font-medium">
                Adicione cada colaborador que assinará a permissão. As assinaturas físicas serão coletadas na impressão.
              </p>
              <div className="space-y-2">
                {(f.equipe_lista ?? []).length === 0 && (
                  <div className="text-center text-slate-300/70 text-xs font-bold uppercase tracking-wider py-6 border border-dashed border-white/15 rounded-xl bg-black/20">
                    Nenhum colaborador adicionado ainda.
                  </div>
                )}
                {(f.equipe_lista ?? []).map((row: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2">
                    <Input
                      value={row.nome}
                      onChange={(e) => {
                        const next = [...f.equipe_lista];
                        next[idx] = { ...next[idx], nome: e.target.value };
                        setF({ ...f, equipe_lista: next });
                      }}
                      placeholder="Nome"
                      className="bg-white/[0.05] border-white/15 text-slate-50 placeholder:text-slate-400 text-sm"
                    />
                    <Input
                      value={row.funcao}
                      onChange={(e) => {
                        const next = [...f.equipe_lista];
                        next[idx] = { ...next[idx], funcao: e.target.value };
                        setF({ ...f, equipe_lista: next });
                      }}
                      placeholder="Função"
                      className="bg-white/[0.05] border-white/15 text-slate-50 placeholder:text-slate-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setF({ ...f, equipe_lista: f.equipe_lista.filter((_: any, i: number) => i !== idx) })}
                      className="h-9 w-9 rounded-lg bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/30 flex items-center justify-center"
                      title="Remover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10">
                <div>
                  <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Encarregado</Label>
                  <Input
                    value={f.assinatura_encarregado_nome}
                    onChange={(e) => setF({ ...f, assinatura_encarregado_nome: e.target.value })}
                    placeholder="Nome do encarregado"
                    className="bg-white/[0.05] border-white/15 text-slate-50 placeholder:text-slate-400 text-sm mt-2"
                  />
                </div>
                <div>
                  <Label className="text-xs font-black text-amber-200/90 uppercase tracking-wider">Gerente da Empresa</Label>
                  <Input
                    value={f.assinatura_gerente_nome}
                    onChange={(e) => setF({ ...f, assinatura_gerente_nome: e.target.value })}
                    placeholder="Nome do gerente"
                    className="bg-white/[0.05] border-white/15 text-slate-50 placeholder:text-slate-400 text-sm mt-2"
                  />
                </div>
                <div>
                  <Label className="text-xs font-black text-lime-200/90 uppercase tracking-wider">Segurança do Trabalho</Label>
                  <div className="mt-2 rounded-lg bg-lime-400/10 border border-lime-300/30 text-lime-100 text-[11px] font-bold uppercase tracking-wider px-3 py-2.5">
                    Assinatura do TST é aplicada no PDF (botão “Assinar TST” na pré-visualização).
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PET / RESGATE */}
          <div hidden={activeStep !== "pet"} className="space-y-6">
            {f.tipo_pt === "PET" && (
              <PteAtmosferaTab petId={editingId} employees={emps as any[]} />
            )}
            {f.tipo_pt === "PET" && (
              <div className="mt-6 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-black/40 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-300" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-200">
                    Plano de Resgate (NR-33 33.3.2.h)
                  </h3>
                  {petModoStrict && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white">
                      Modo Strict — Obrigatório
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-amber-200/60 uppercase">
                  Sem plano de resgate documentado, o TST responde criminalmente em caso de óbito.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-black text-amber-200/80 uppercase">Equipe de Resgate *</Label>
                    <Input
                      value={f.plano_equipe_resgate}
                      onChange={(e) => setF({ ...f, plano_equipe_resgate: e.target.value })}
                      placeholder="Nomes/funções (ex: Brigada + Bombeiro Civil João)"
                      className="bg-black/40 border-amber-500/30 text-amber-50 text-xs h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black text-amber-200/80 uppercase">Equipamentos *</Label>
                    <Input
                      value={f.plano_equipamentos}
                      onChange={(e) => setF({ ...f, plano_equipamentos: e.target.value })}
                      placeholder="Tripé, maca, cinto paraquedista, EPR autônomo..."
                      className="bg-black/40 border-amber-500/30 text-amber-50 text-xs h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black text-amber-200/80 uppercase">Hospital de Referência *</Label>
                    <Input
                      value={f.plano_hospital_referencia}
                      onChange={(e) => setF({ ...f, plano_hospital_referencia: e.target.value })}
                      placeholder="Hospital + telefone (ex: HGCA — 22 2733-0000)"
                      className="bg-black/40 border-amber-500/30 text-amber-50 text-xs h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black text-amber-200/80 uppercase">Tempo Resposta (min) *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={f.plano_tempo_resposta_min}
                      onChange={(e) => setF({ ...f, plano_tempo_resposta_min: e.target.value })}
                      placeholder="5"
                      className="bg-black/40 border-amber-500/30 text-amber-50 text-xs h-9"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px] font-black text-amber-200/80 uppercase">Meio de Comunicação</Label>
                    <Input
                      value={f.plano_meio_comunicacao}
                      onChange={(e) => setF({ ...f, plano_meio_comunicacao: e.target.value })}
                      placeholder="Rádio canal 5 + celular 22 99999-0000"
                      className="bg-black/40 border-amber-500/30 text-amber-50 text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            )}
            {f.tipo_pt === "PET" && !petModoStrict && (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-950/30 px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                <div className="text-[10px] font-bold text-amber-100 uppercase leading-relaxed">
                  Modo Relax ativo. A PET vai ser emitida mesmo sem medição/plano de resgate — mas o sistema vai gritar no histórico. Ligue o Modo Strict em Configurações para bloquear PETs incompletas automaticamente.
                </div>
              </div>
            )}
          </div>

          {/* REVISÃO */}
          <div hidden={activeStep !== "revisao"} className="space-y-4">
            <div className="rounded-2xl border border-lime-400/30 bg-gradient-to-br from-lime-500/5 via-black/40 to-rose-950/30 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-lime-200 border-b border-lime-400/20 pb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Revisão & Emissão
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {STEPS.filter((s) => s.id !== "revisao").map((s) => {
                  const ok = (stepChecks as any)[s.id] === true;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveStep(s.id)}
                      className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                        ok
                          ? "bg-lime-500/10 border-lime-400/40 text-lime-100 hover:bg-lime-500/20"
                          : "bg-amber-500/10 border-amber-400/40 text-amber-100 hover:bg-amber-500/20"
                      }`}
                    >
                      <div className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</div>
                      <div className="text-[10px] font-black uppercase flex items-center gap-1 mt-0.5">
                        {ok ? <><CheckCircle2 className="h-3 w-3" /> Pronto</> : <><AlertTriangle className="h-3 w-3" /> Pendente</>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-bold uppercase text-slate-200/90">
                <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Tipo: <span className="text-rose-50 font-black">{f.tipo_pt}</span></div>
                <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Data: <span className="text-rose-50 font-black">{formatDateBR(f.data)}</span></div>
                <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Horário: <span className="text-rose-50 font-black">{f.hora_inicio} → {f.hora_fim}</span></div>
                <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 md:col-span-2">Local: <span className="text-rose-50 font-black">{f.local || "—"}</span></div>
                <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Executantes: <span className="text-rose-50 font-black">{f.executantes_ids?.length ?? 0}</span></div>
              </div>
              <Button
                type="submit"
                disabled={save.isPending}
                className={`w-full text-xs font-black uppercase tracking-widest h-auto px-8 py-4 rounded-xl flex items-center justify-center gap-2 text-white border transition-all ${
                  editingId
                    ? "bg-gradient-to-br from-blue-600/90 to-blue-900/90 border-blue-400/40 shadow-[0_0_24px_-4px_rgba(59,130,246,0.6)] hover:shadow-[0_0_32px_-2px_rgba(59,130,246,0.9)]"
                    : "bg-gradient-to-r from-lime-500 via-amber-500 to-rose-600 border-amber-300/50 shadow-[0_0_28px_-4px_rgba(245,158,11,0.9)] hover:shadow-[0_0_40px_-2px_rgba(220,38,70,0.9)]"
                }`}
              >
                <Printer className="h-4 w-4" /> {editingId ? "Salvar Alterações" : "Emitir Permissão"}
              </Button>
            </div>
          </div>

          {/* Navegação inferior */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-black/40 text-rose-100 border border-white/10 px-4 py-2.5 rounded-xl hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-300/70">
              {stepIndex + 1} / {STEPS.length}
            </div>
            {!isLast ? (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 to-rose-600 text-white border border-amber-300/50 px-4 py-2.5 rounded-xl hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.9)]"
              >
                Avançar <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="text-[9px] font-black uppercase tracking-widest text-lime-300 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Última etapa
              </span>
            )}
          </div>
          </form>
        </div>

        {/* HISTORY */}
        <div className="glass-card glass-shine rounded-2xl p-4 sm:p-6 md:p-8">
          <h3 className="text-sm font-black text-rose-100 uppercase tracking-widest mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
            <Files className="h-5 w-5" /> Histórico de Permissões
          </h3>
          <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {ptes.length === 0 && (
              <div className="text-center text-slate-300/60 py-10 font-bold uppercase text-xs border border-dashed border-white/10 rounded-2xl bg-black/20">
                Nenhuma permissão foi emitida até o momento.
              </div>
            )}
            {ptes.map((p: any) => (
              <div key={p.id} className={`glass-card p-5 rounded-2xl transition-all hover:-translate-y-0.5 ${p.status !== "ATIVA" ? "opacity-60" : ""}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black uppercase text-slate-200/90 tracking-widest">Nº <span className="text-rose-100">{p.numero}</span></div>
                    {p.tipo_pt && p.tipo_pt !== "PTE" && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-950/70 text-indigo-200 border border-indigo-500/30">{p.tipo_pt}</span>
                    )}
                    {p.tipo_pt === "PET" && p.status === "ATIVA" && petAlertas.get(p.id)?.foraLimite && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white flex items-center gap-1" title="Última medição atmosférica fora do limite NR-33">
                        <AlertTriangle className="h-3 w-3" /> ATMOSFERA FORA DO LIMITE
                      </span>
                    )}
                    {p.tipo_pt === "PET" && p.status === "ATIVA" && petAlertas.get(p.id)?.needsEntrada && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-black flex items-center gap-1" title="PET ativa sem medição de ENTRADA conforme registrada">
                        <AlertTriangle className="h-3 w-3" /> MEDIÇÃO PENDENTE
                      </span>
                    )}
                    {p.tipo_pt === "PET" && petAlertas.get(p.id)?.needsPlano && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-orange-600 text-white flex items-center gap-1" title="Plano de resgate NR-33 33.3.2.h não preenchido">
                        <AlertTriangle className="h-3 w-3" /> SEM PLANO DE RESGATE
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest border ${p.status === "ATIVA" ? "bg-gradient-to-br from-amber-600/80 to-amber-900/80 text-amber-50 border-amber-400/40 shadow-[0_0_12px_-2px_rgba(245,158,11,0.5)]" : "bg-black/40 text-slate-300/70 border-white/10"}`}>{p.status}</div>
                    <button onClick={() => setPreviewPt(p)} className="w-6 h-6 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors" title="Visualizar / Imprimir PDF">
                      <FileSearch className="h-3 w-3" />
                    </button>
                    {isEditor && (
                      <button onClick={() => startEdit(p)} className="w-6 h-6 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors" title="Editar">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => { if (confirm("Excluir PTE?")) del.mutate(p.id); }} className="w-6 h-6 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors" title="Excluir">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {(() => {
                  const reqName = emps.find((e: any) => e.id === (p.requisitante_id ?? p.employee_id))?.nome ?? p.employee_name;
                  const execIds = (p.executantes_ids as string[] | null) ?? [];
                  const execNames = execIds.map((id) => emps.find((e: any) => e.id === id)?.nome).filter(Boolean);
                  const vigiaName = p.vigia_id ? emps.find((e: any) => e.id === p.vigia_id)?.nome : null;
                  const supName = p.supervisor_entrada_id ? emps.find((e: any) => e.id === p.supervisor_entrada_id)?.nome : null;
                  return (
                    <>
                      {reqName && (
                        <div className="text-[10px] font-bold text-slate-200/80 uppercase flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> Requisitante: <span className="font-black text-rose-100">{reqName}</span>
                        </div>
                      )}
                      {execNames.length > 0 && (
                        <div className="text-[10px] font-bold text-slate-200/80 uppercase flex items-start gap-1 mt-0.5">
                          <Users className="h-3 w-3 mt-0.5 shrink-0" /> Executantes: <span className="font-black text-rose-50">{execNames.join(", ")}</span>
                        </div>
                      )}
                      {vigiaName && (
                        <div className="text-[10px] font-bold text-amber-300 uppercase flex items-center gap-1 mt-0.5">
                          <Eye className="h-3 w-3" /> Vigia: <span className="font-black">{vigiaName}</span>
                        </div>
                      )}
                      {supName && (
                        <div className="text-[10px] font-bold text-amber-300 uppercase flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="h-3 w-3" /> Supervisor: <span className="font-black">{supName}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="text-[10px] font-bold text-slate-200/80 uppercase mt-2">Risco: <span className="font-black text-rose-50">{p.risco}</span></div>
                <div className="text-[10px] font-bold text-slate-200/80 uppercase">Local: <span className="text-rose-100">{p.local ?? "—"}</span></div>
                {(p.hora_inicio || p.hora_fim) && (
                  <div className="text-[10px] font-bold text-slate-200/80 uppercase">
                    Horário: <span className="font-black text-rose-50">{p.hora_inicio ?? "—"} → {p.hora_fim ?? "—"}</span>
                  </div>
                )}
                {p.casco_id && (
                  <div className="text-[10px] font-bold text-indigo-300 uppercase">
                    Casco: <span className="font-black">{(cascosMap.get(p.casco_id) as any)?.numero ?? "—"}</span>
                    {(cascosMap.get(p.casco_id) as any)?.nome ? ` — ${(cascosMap.get(p.casco_id) as any).nome}` : ""}
                  </div>
                )}
                {p.apr_id && (
                  <div className="text-[10px] font-bold text-emerald-300 uppercase mt-1 flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> APR {(aprsMap.get(p.apr_id) as any)?.numero ?? p.apr_id.slice(0, 8)}
                  </div>
                )}
                {p.emergencia_sem_apr && (
                  <div className="text-[10px] font-black text-amber-200 uppercase mt-1 flex items-center gap-1 bg-amber-950/40 border border-amber-500/30 px-2 py-1 rounded">
                    <AlertTriangle className="h-3 w-3" /> Emergência — sem APR
                  </div>
                )}
                <div className="text-[9px] font-black text-slate-300/60 uppercase mt-3 tracking-widest flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Emitida em: {formatDateBR(p.data_emissao || p.data)}
                </div>
                {p.status === "ATIVA" && isEditor && (
                  <button onClick={() => revoke.mutate(p.id)} className="mt-4 w-full py-2 bg-black/40 border border-rose-500/30 text-rose-300 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-600 hover:text-white hover:border-rose-400 transition-colors flex items-center justify-center gap-1">
                    <X className="h-3 w-3" /> Encerrar / Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PtPdfPreview
        open={!!previewPt}
        onClose={() => setPreviewPt(null)}
        pt={previewPt}
        apr={previewPt?.apr_id ? aprsMap.get(previewPt.apr_id) : undefined}
        casco={previewPt?.casco_id ? cascosMap.get(previewPt.casco_id) : undefined}
        company={previewPt?.company_id ? (companies as any[]).find((c: any) => c.id === previewPt.company_id) : undefined}
        employees={emps as any[]}
      />
    </div>
  );
}

// Wizard "Nova Entrada" — mobile-first, 4 passos.
// Fluxo: 1) CPF → se já cadastrado pula pro passo 3;  2) dados novos;
// 3) foto rosto + motivo + empresa visitada;  4) veículo opcional + acompanhantes.
// Grava tudo em portaria_pessoas, portaria_veiculos, portaria_visitas e
// portaria_visita_acompanhantes numa transação otimista (rollback manual em caso de erro).

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, ArrowLeft, ArrowRight, Check, Search, AlertTriangle, X, Loader2, UserPlus, Car, Briefcase, UserX } from "lucide-react";
import { isValidCPF, maskCPF, onlyDigits, formatCPFFromDigits } from "@/lib/validators/cpf";
import { isValidPlaca, normalizePlaca, maskPlaca } from "@/lib/validators/placa";
import { uploadFotoPortaria, type FotoTipo } from "@/lib/portaria/foto-upload";

type Tipo = "VISITANTE" | "FORNECEDOR" | "PRESTADOR";

type PessoaExistente = {
  id: string; nome: string; cpf: string; rg: string | null; cnpj: string | null;
  foto_documento_url: string | null; bloqueado: boolean; motivo_bloqueio: string | null;
};
type EmployeeMatch = {
  id: string;
  nome: string;
  cpf: string;
  rg: string | null;
  foto_url: string | null;
  status: "ATIVO" | "DESLIGADO" | string;
  setor: string | null;
  matricula: string | null;
  admissao: string | null;
  data_desligamento: string | null;
  motivo_desligamento: string | null;
  company: string | null;
  role: string | null;
};
type VeiculoExistente = { id: string; placa: string; modelo: string | null; tipo: string | null };

type Companion = {
  cpf: string; nome: string; rg: string; pessoaId?: string; foto?: File | null;
};

type Companies = { id: string; name: string }[];

export function NovaEntradaWizard({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Passo 1 — tipo + CPF principal
  const [tipo, setTipo] = useState<Tipo>("VISITANTE");
  const [cpfInput, setCpfInput] = useState("");
  const [pessoaExistente, setPessoaExistente] = useState<PessoaExistente | null>(null);
  const [employeeMatch, setEmployeeMatch] = useState<EmployeeMatch | null>(null);
  // Porteiro precisa confirmar override quando funcionário ATIVO tenta entrar como visita
  const [ativoOverride, setAtivoOverride] = useState(false);
  const [ativoJustificativa, setAtivoJustificativa] = useState("");
  const [buscando, setBuscando] = useState(false);

  // Passo 2 — dados novos
  const [nome, setNome] = useState("");
  const [rg, setRg] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [fotoDocumento, setFotoDocumento] = useState<File | null>(null);

  // Passo 3 — visita
  const [fotoRosto, setFotoRosto] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [empresaVisitadaId, setEmpresaVisitadaId] = useState("");
  const [funcionarioRecebedorId, setFuncionarioRecebedorId] = useState<string>("");
  const [companies, setCompanies] = useState<Companies>([]);
  const [funcQuery, setFuncQuery] = useState("");
  const [funcResults, setFuncResults] = useState<{ id: string; nome: string; cpf: string }[]>([]);

  // Passo 4 — veículo + acompanhantes
  const [temVeiculo, setTemVeiculo] = useState(false);
  const [placaInput, setPlacaInput] = useState("");
  const [placaExistente, setPlacaExistente] = useState<VeiculoExistente | null>(null);
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<string>("CARRO");
  const [fotoPlaca, setFotoPlaca] = useState<File | null>(null);
  const [fotoBagageiro, setFotoBagageiro] = useState<File | null>(null);
  const [acompanhantes, setAcompanhantes] = useState<Companion[]>([]);

  // Reset ao abrir
  useEffect(() => {
    if (!open) return;
    setStep(1); setTipo("VISITANTE"); setCpfInput(""); setPessoaExistente(null);
    setEmployeeMatch(null); setAtivoOverride(false); setAtivoJustificativa("");
    setNome(""); setRg(""); setCnpj(""); setFotoDocumento(null);
    setFotoRosto(null); setMotivo(""); setEmpresaVisitadaId(""); setFuncionarioRecebedorId("");
    setFuncQuery(""); setFuncResults([]);
    setTemVeiculo(false); setPlacaInput(""); setPlacaExistente(null); setModelo(""); setCor("");
    setTipoVeiculo("CARRO"); setFotoPlaca(null); setFotoBagageiro(null); setAcompanhantes([]);
    supabase.from("companies").select("id,name").order("name").then(({ data }) => setCompanies(data ?? []));
  }, [open]);

  // Busca de pessoa por CPF (débounce simples via botão explícito)
  const buscarPessoa = async () => {
    const cpfLimpo = onlyDigits(cpfInput);
    if (!isValidCPF(cpfLimpo)) {
      toast.error("CPF inválido");
      return;
    }
    setBuscando(true);
    // Consulta portaria_pessoas + employees em paralelo — ex/atual funcionário deve ser reconhecido.
    const [pessoaRes, empRes] = await Promise.all([
      supabase
        .from("portaria_pessoas")
        .select("id,nome,cpf,rg,cnpj,foto_documento_url,bloqueado,motivo_bloqueio")
        .eq("cpf", cpfLimpo)
        .maybeSingle(),
      supabase
        .from("employees")
        .select("id,nome,cpf,rg,foto_url,status,setor,matricula,admissao,data_desligamento,motivo_desligamento,companies(name),roles(name)")
        .eq("cpf", cpfLimpo)
        .order("status", { ascending: true }) // ATIVO vem antes de DESLIGADO no alfabético
        .limit(1)
        .maybeSingle(),
    ]);
    setBuscando(false);
    if (pessoaRes.error) { toast.error("Erro: " + pessoaRes.error.message); return; }

    const pessoa = (pessoaRes.data ?? null) as PessoaExistente | null;
    const emp = (empRes.data ?? null) as any;

    setPessoaExistente(pessoa);
    setAtivoOverride(false);
    setAtivoJustificativa("");

    if (emp) {
      const match: EmployeeMatch = {
        id: emp.id,
        nome: emp.nome,
        cpf: emp.cpf,
        rg: emp.rg ?? null,
        foto_url: emp.foto_url ?? null,
        status: emp.status,
        setor: emp.setor ?? null,
        matricula: emp.matricula ?? null,
        admissao: emp.admissao ?? null,
        data_desligamento: emp.data_desligamento ?? null,
        motivo_desligamento: emp.motivo_desligamento ?? null,
        company: emp.companies?.name ?? null,
        role: emp.roles?.name ?? null,
      };
      setEmployeeMatch(match);
      // Pré-preenche dados do passo 2 (nome/rg) puxados da ficha,
      // mesmo que pessoa da portaria também exista — ficha vence porque é dado RH validado.
      setNome(match.nome);
      if (match.rg) setRg(match.rg);
      if (match.status === "ATIVO") {
        toast.error("⚠️ Funcionário ATIVO — confirme se realmente é uma visita");
      } else {
        toast.warning(`Ex-funcionário identificado (desligado em ${
          match.data_desligamento ? new Date(match.data_desligamento).toLocaleDateString("pt-BR") : "data ?"
        })`);
      }
    } else {
      setEmployeeMatch(null);
    }

    if (pessoa) {
      if (pessoa.bloqueado) {
        toast.error(`Pessoa BLOQUEADA: ${pessoa.motivo_bloqueio ?? "sem motivo registrado"}`);
      } else if (!emp) {
        toast.success(`Cadastro encontrado: ${pessoa.nome}`);
      }
    } else if (!emp) {
      toast.info("Novo cadastro — preencha os dados no próximo passo");
    }
  };

  // Busca funcionário recebedor
  useEffect(() => {
    if (funcQuery.trim().length < 3) { setFuncResults([]); return; }
    const t = setTimeout(async () => {
      const q = funcQuery.trim();
      const { data } = await supabase.from("employees")
        .select("id,nome,cpf")
        .eq("status","ATIVO")
        .or(`nome.ilike.%${q}%,cpf.ilike.%${onlyDigits(q)}%`)
        .limit(8);
      setFuncResults((data ?? []).map((f: any) => ({ id: f.id, nome: f.nome, cpf: f.cpf ?? "" })));
    }, 250);
    return () => clearTimeout(t);
  }, [funcQuery]);

  // Busca de veículo por placa
  const buscarVeiculo = async () => {
    const p = normalizePlaca(placaInput);
    if (!isValidPlaca(p)) { toast.error("Placa inválida"); return; }
    const { data } = await supabase
      .from("portaria_veiculos")
      .select("id,placa,modelo,tipo")
      .eq("placa", p)
      .maybeSingle();
    if (data) {
      setPlacaExistente(data as VeiculoExistente);
      setModelo((data as any).modelo ?? "");
      setTipoVeiculo((data as any).tipo ?? "CARRO");
      toast.success(`Veículo cadastrado: ${(data as any).modelo ?? "sem modelo"}`);
    } else {
      setPlacaExistente(null);
      toast.info("Placa nova — preencha modelo e tipo");
    }
  };

  const irParaProximo = () => {
    if (step === 1) {
      if (!isValidCPF(cpfInput)) return toast.error("CPF inválido");
      // Trava funcionário ATIVO — só passa com override + justificativa
      if (employeeMatch?.status === "ATIVO" && !ativoOverride) {
        return toast.error("Marque a confirmação de override para funcionário ativo");
      }
      if (employeeMatch?.status === "ATIVO" && ativoOverride && ativoJustificativa.trim().length < 5) {
        return toast.error("Justifique a entrada do funcionário ativo (mínimo 5 caracteres)");
      }
      // Se pessoa OU ex-funcionário existe, pula passo 2 (já temos nome/rg/foto)
      if (pessoaExistente || employeeMatch) { setStep(3); return; }
      setStep(2); return;
    }
    if (step === 2) {
      if (!nome.trim()) return toast.error("Nome obrigatório");
      if (!fotoDocumento) return toast.error("Foto do documento é obrigatória no primeiro cadastro");
      setStep(3); return;
    }
    if (step === 3) {
      const temFotoPrevia = pessoaExistente?.foto_documento_url || employeeMatch?.foto_url;
      if (!fotoRosto && !temFotoPrevia) return toast.error("Foto do rosto obrigatória");
      if (!motivo.trim()) return toast.error("Motivo obrigatório");
      if (!empresaVisitadaId) return toast.error("Selecione a empresa visitada");
      setStep(4); return;
    }
  };

  const voltar = () => {
    if (step === 3 && (pessoaExistente || employeeMatch)) { setStep(1); return; }
    setStep((s) => Math.max(1, s - 1));
  };

  const addAcompanhante = () => {
    if (acompanhantes.length >= 2) return;
    setAcompanhantes((a) => [...a, { cpf: "", nome: "", rg: "" }]);
  };
  const updAcompanhante = (i: number, patch: Partial<Companion>) => {
    setAcompanhantes((a) => a.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  };
  const removeAcompanhante = (i: number) => setAcompanhantes((a) => a.filter((_, k) => k !== i));

  const buscarAcompanhante = async (i: number) => {
    const c = acompanhantes[i];
    const cpf = onlyDigits(c.cpf);
    if (!isValidCPF(cpf)) { toast.error("CPF acompanhante inválido"); return; }
    const { data } = await supabase.from("portaria_pessoas")
      .select("id,nome,rg").eq("cpf", cpf).maybeSingle();
    if (data) {
      updAcompanhante(i, { pessoaId: data.id, nome: data.nome, rg: (data as any).rg ?? "" });
      toast.success(`Acompanhante encontrado: ${data.nome}`);
    } else {
      updAcompanhante(i, { pessoaId: undefined });
      toast.info("Acompanhante novo — preencha nome");
    }
  };

  const finalizar = useMutation({
    mutationFn: async () => {
      setSaving(true);
      const cpfLimpo = onlyDigits(cpfInput);
      // 1) Garantir pessoa principal
      let pessoaId = pessoaExistente?.id;
      if (!pessoaId) {
        const { data: novaP, error } = await supabase.from("portaria_pessoas").insert({
          cpf: cpfLimpo, nome: nome.trim(), rg: rg.trim() || null, cnpj: onlyDigits(cnpj) || null,
          created_by: user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        pessoaId = novaP.id;
      }

      // 2) Garantir veículo (se houver)
      let veiculoId: string | null = null;
      if (temVeiculo && placaInput) {
        const p = normalizePlaca(placaInput);
        if (placaExistente) {
          veiculoId = placaExistente.id;
        } else {
          const { data: novoV, error } = await supabase.from("portaria_veiculos").insert({
            placa: p, modelo: modelo.trim() || null, cor: cor.trim() || null,
            tipo: tipoVeiculo, created_by: user?.id ?? null,
          }).select("id").single();
          if (error) throw error;
          veiculoId = novoV.id;
        }
      }

      // 3) Gerar ID da visita ANTES do upload (path das fotos usa esse id)
      const visitaId = crypto.randomUUID();

      // 4) Upload das fotos
      const uploads: Record<string, string | null> = {
        foto_rosto_url: null, foto_placa_url: null, foto_bagageiro_url: null, foto_documento_url: null,
      };
      const doUp = async (file: File | null, tipo: FotoTipo) => {
        if (!file) return null;
        try { return await uploadFotoPortaria(file, tipo, visitaId); }
        catch (e: any) { throw new Error(`Falha ao enviar foto ${tipo}: ${e.message}`); }
      };
      uploads.foto_rosto_url = await doUp(fotoRosto, "rosto");
      if (temVeiculo) {
        uploads.foto_placa_url = await doUp(fotoPlaca, "placa");
        uploads.foto_bagageiro_url = await doUp(fotoBagageiro, "bagageiro");
      }
      // Foto do documento (só no primeiro cadastro da pessoa)
      if (!pessoaExistente && fotoDocumento) {
        const docPath = await doUp(fotoDocumento, "documento");
        if (docPath && pessoaId) {
          await supabase.from("portaria_pessoas").update({ foto_documento_url: docPath }).eq("id", pessoaId);
        }
      }

      // 5) Insere a visita
      const { error: errV } = await supabase.from("portaria_visitas").insert({
        id: visitaId,
        tipo,
        pessoa_id: pessoaId!,
        veiculo_id: veiculoId,
        empresa_visitada_id: empresaVisitadaId,
        funcionario_recebedor_id: funcionarioRecebedorId || null,
        motivo_visita: motivo.trim() || null,
        foto_rosto_url: uploads.foto_rosto_url,
        foto_placa_url: uploads.foto_placa_url,
        foto_bagageiro_url: uploads.foto_bagageiro_url,
        entrada_por_user_id: user?.id ?? null,
        status: "DENTRO",
      });
      if (errV) throw errV;

      // 5.1) Auditoria — registra vínculo com funcionário (ativo ou desligado) para rastreabilidade
      if (employeeMatch) {
        await supabase.from("portaria_auditoria").insert({
          entidade: "portaria_visitas",
          entidade_id: visitaId,
          acao: employeeMatch.status === "ATIVO" ? "FUNCIONARIO_ATIVO_OVERRIDE" : "EX_FUNCIONARIO_ENTRADA",
          origem_modulo: "portaria",
          user_id: user?.id ?? null,
          snapshot_json: {
            employee_id: employeeMatch.id,
            employee_nome: employeeMatch.nome,
            employee_status: employeeMatch.status,
            employee_matricula: employeeMatch.matricula,
            employee_setor: employeeMatch.setor,
            employee_data_desligamento: employeeMatch.data_desligamento,
            employee_motivo_desligamento: employeeMatch.motivo_desligamento,
            override_justificativa: employeeMatch.status === "ATIVO" ? ativoJustificativa.trim() : null,
          },
        });
      }

      // 6) Acompanhantes
      for (let i = 0; i < acompanhantes.length; i++) {
        const c = acompanhantes[i];
        let pid = c.pessoaId;
        if (!pid) {
          const cpfC = onlyDigits(c.cpf);
          if (!isValidCPF(cpfC)) throw new Error(`CPF do acompanhante ${i + 1} inválido`);
          if (!c.nome.trim()) throw new Error(`Nome do acompanhante ${i + 1} obrigatório`);
          const { data: pnew, error } = await supabase.from("portaria_pessoas").insert({
            cpf: cpfC, nome: c.nome.trim(), rg: c.rg.trim() || null, created_by: user?.id ?? null,
          }).select("id").single();
          if (error) throw error;
          pid = pnew.id;
        }
        let fotoAcomp: string | null = null;
        if (c.foto) fotoAcomp = await doUp(c.foto, i === 0 ? "acompanhante1" : "acompanhante2");
        await supabase.from("portaria_visita_acompanhantes").insert({
          visita_id: visitaId, pessoa_id: pid!, foto_rosto_url: fotoAcomp, ordem: (i + 1) as 1 | 2,
        });
      }
    },
    onSuccess: () => {
      toast.success("Entrada registrada");
      qc.invalidateQueries({ queryKey: ["portaria-visitas"] });
      qc.invalidateQueries({ queryKey: ["portaria-kpis"] });
      setSaving(false);
      onClose();
    },
    onError: (e: any) => { setSaving(false); toast.error("Falha: " + e.message); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 h-[92vh] sm:h-auto sm:max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-none px-4 py-3 border-b bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-lg">Nova Entrada</h2>
            <button onClick={() => !saving && onClose()} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-2 flex gap-1">
            {[1,2,3,4].map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold mt-1 text-white/80">
            Passo {step === 2 && pessoaExistente ? 3 : step} de 4
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest">Tipo</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(["VISITANTE","FORNECEDOR","PRESTADOR"] as Tipo[]).map((t) => (
                    <button key={t}
                      onClick={() => setTipo(t)}
                      className={`h-11 rounded-xl border-2 text-[11px] font-black uppercase ${tipo===t ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest">CPF do visitante</Label>
                <div className="flex gap-2 mt-2">
                  <Input inputMode="numeric" placeholder="000.000.000-00"
                    value={maskCPF(cpfInput)} onChange={(e) => { setCpfInput(e.target.value); setPessoaExistente(null); }}
                    className="h-12 text-base" />
                  <Button onClick={buscarPessoa} disabled={buscando} className="h-12 px-4 bg-slate-800 hover:bg-slate-900">
                    {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {pessoaExistente && (
                <div className={`rounded-xl p-3 border-2 ${pessoaExistente.bloqueado ? "bg-red-50 border-red-300" : "bg-emerald-50 border-emerald-300"}`}>
                  <div className="flex items-center gap-2">
                    {pessoaExistente.bloqueado
                      ? <AlertTriangle className="h-5 w-5 text-red-600" />
                      : <Check className="h-5 w-5 text-emerald-600" />}
                    <div className="min-w-0">
                      <p className="font-black text-sm">{pessoaExistente.nome}</p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">CPF {formatCPFFromDigits(pessoaExistente.cpf)}</p>
                      {pessoaExistente.bloqueado && (
                        <p className="text-xs text-red-700 font-bold mt-1">Bloqueado: {pessoaExistente.motivo_bloqueio ?? "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {employeeMatch && (
                <div className={`rounded-xl p-3 border-2 ${
                  employeeMatch.status === "ATIVO" ? "bg-red-50 border-red-400" : "bg-amber-50 border-amber-400"
                }`}>
                  <div className="flex gap-3">
                    {employeeMatch.foto_url ? (
                      <SignedAvatarImg src={employeeMatch.foto_url} alt={employeeMatch.nome}
                        className="h-16 w-16 rounded-lg object-cover border-2 border-white shadow-sm flex-none" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-slate-200 flex items-center justify-center flex-none">
                        {employeeMatch.status === "ATIVO"
                          ? <Briefcase className="h-6 w-6 text-red-600" />
                          : <UserX className="h-6 w-6 text-amber-600" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          employeeMatch.status === "ATIVO" ? "bg-red-600 text-white" : "bg-amber-600 text-white"
                        }`}>
                          {employeeMatch.status === "ATIVO" ? "Funcionário ATIVO" : "Ex-funcionário"}
                        </span>
                        {employeeMatch.matricula && (
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Mat. {employeeMatch.matricula}</span>
                        )}
                      </div>
                      <p className="font-black text-sm mt-1 truncate">{employeeMatch.nome}</p>
                      <p className="text-[11px] text-slate-600 truncate">
                        {employeeMatch.role ?? "—"} · {employeeMatch.setor ?? "sem setor"}
                      </p>
                      {employeeMatch.company && (
                        <p className="text-[10px] text-slate-500 truncate">{employeeMatch.company}</p>
                      )}
                      {employeeMatch.status === "DESLIGADO" && (
                        <div className="mt-1.5 text-[11px] text-amber-800">
                          <p><strong>Desligado em:</strong> {employeeMatch.data_desligamento
                            ? new Date(employeeMatch.data_desligamento).toLocaleDateString("pt-BR")
                            : "—"}</p>
                          {employeeMatch.motivo_desligamento && (
                            <p><strong>Motivo:</strong> {employeeMatch.motivo_desligamento}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {employeeMatch.status === "ATIVO" && (
                    <div className="mt-3 space-y-2 border-t border-red-200 pt-2">
                      <p className="text-[11px] text-red-800 font-bold">
                        Este CPF é de funcionário ATIVO. Se for entrada normal, use catraca/ponto. Só prossiga como visita se houver motivo excepcional (buscar documento fora do horário, reunião fora do turno, etc.).
                      </p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={ativoOverride}
                          onChange={(e) => setAtivoOverride(e.target.checked)}
                          className="mt-0.5 h-4 w-4" />
                        <span className="text-[11px] font-bold text-red-900">
                          Confirmo entrada como visita mesmo sendo funcionário ativo (será auditado)
                        </span>
                      </label>
                      {ativoOverride && (
                        <Textarea
                          value={ativoJustificativa}
                          onChange={(e) => setAtivoJustificativa(e.target.value)}
                          placeholder="Justificativa obrigatória (ex: veio buscar documento fora do horário)"
                          rows={2}
                          className="text-xs"
                        />
                      )}
                    </div>
                  )}
                  {employeeMatch.status === "DESLIGADO" && (
                    <p className="mt-2 text-[11px] text-amber-800 border-t border-amber-200 pt-2">
                      Nome, RG e foto já pré-carregados da ficha. Prossiga normalmente — a entrada ficará registrada no histórico como ex-funcionário.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest">Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 text-base mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-black uppercase tracking-widest">RG</Label>
                  <Input value={rg} onChange={(e) => setRg(e.target.value)} className="h-11 mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-black uppercase tracking-widest">CNPJ</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="h-11 mt-1" inputMode="numeric" />
                </div>
              </div>
              <FotoField label="Foto do documento *" value={fotoDocumento} onChange={setFotoDocumento} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {(pessoaExistente?.foto_documento_url || employeeMatch?.foto_url) && (
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-3 flex items-center gap-3">
                  <SignedAvatarImg
                    src={(pessoaExistente?.foto_documento_url ?? employeeMatch?.foto_url) as string}
                    alt="Foto do cadastro"
                    className="h-16 w-16 rounded-lg object-cover border-2 border-white shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                      Foto do cadastro {employeeMatch ? "(ficha RH)" : "(portaria)"}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Já existe foto — a foto do rosto abaixo é opcional. Capture nova se estiver muito diferente.
                    </p>
                  </div>
                </div>
              )}
              <FotoField
                label="Foto do rosto *"
                value={fotoRosto}
                onChange={setFotoRosto}
                fallbackHint={
                  employeeMatch?.foto_url
                    ? "Ficha RH tem foto — nova é opcional"
                    : pessoaExistente?.foto_documento_url
                    ? "Já existe foto no cadastro — nova é opcional"
                    : undefined
                }
              />
              <div>
                <Label className="text-xs font-black uppercase tracking-widest">Empresa visitada *</Label>
                <Select value={empresaVisitadaId} onValueChange={setEmpresaVisitadaId}>
                  <SelectTrigger className="h-12 mt-1"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest">Motivo *</Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest">Funcionário recebedor (opcional)</Label>
                <Input placeholder="Buscar por nome ou CPF…" value={funcQuery} onChange={(e) => setFuncQuery(e.target.value)} className="h-11 mt-1" />
                {funcResults.length > 0 && (
                  <div className="mt-2 border rounded-xl divide-y max-h-40 overflow-y-auto">
                    {funcResults.map((f) => (
                      <button key={f.id}
                        onClick={() => { setFuncionarioRecebedorId(f.id); setFuncQuery(f.nome); setFuncResults([]); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${funcionarioRecebedorId===f.id ? "bg-emerald-50" : ""}`}>
                        <p className="font-bold">{f.nome}</p>
                        <p className="text-[10px] text-slate-500">{formatCPFFromDigits(f.cpf)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tem_veic" checked={temVeiculo} onChange={(e) => setTemVeiculo(e.target.checked)} className="h-5 w-5" />
                <label htmlFor="tem_veic" className="text-sm font-bold">Entrou com veículo</label>
              </div>
              {temVeiculo && (
                <div className="space-y-3 rounded-xl border-2 border-slate-200 p-3">
                  <div>
                    <Label className="text-xs font-black uppercase tracking-widest">Placa</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={maskPlaca(placaInput)} onChange={(e) => { setPlacaInput(e.target.value); setPlacaExistente(null); }} className="h-11 text-base uppercase" placeholder="ABC-1234" />
                      <Button onClick={buscarVeiculo} className="h-11 px-3 bg-slate-800 hover:bg-slate-900"><Search className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-black uppercase tracking-widest">Modelo</Label>
                      <Input value={modelo} onChange={(e) => setModelo(e.target.value)} className="h-11 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-black uppercase tracking-widest">Tipo</Label>
                      <Select value={tipoVeiculo} onValueChange={setTipoVeiculo}>
                        <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["CARRO","MOTO","CAMINHAO","VAN","ONIBUS","OUTRO"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FotoField label="Foto da placa" value={fotoPlaca} onChange={setFotoPlaca} />
                  <FotoField label="Foto do bagageiro/porta-malas" value={fotoBagageiro} onChange={setFotoBagageiro} />
                </div>
              )}

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-black uppercase tracking-widest">Acompanhantes ({acompanhantes.length}/2)</Label>
                  <Button size="sm" variant="outline" onClick={addAcompanhante} disabled={acompanhantes.length >= 2}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {acompanhantes.map((c, i) => (
                  <div key={i} className="rounded-xl border-2 border-slate-200 p-3 space-y-2 mb-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Acompanhante {i + 1}</p>
                      <button onClick={() => removeAcompanhante(i)}><X className="h-4 w-4 text-slate-400" /></button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={maskCPF(c.cpf)} onChange={(e) => updAcompanhante(i, { cpf: e.target.value, pessoaId: undefined })} placeholder="CPF" className="h-11" inputMode="numeric" />
                      <Button onClick={() => buscarAcompanhante(i)} className="h-11 px-3 bg-slate-800 hover:bg-slate-900"><Search className="h-4 w-4" /></Button>
                    </div>
                    <Input value={c.nome} onChange={(e) => updAcompanhante(i, { nome: e.target.value })} placeholder="Nome" className="h-11" disabled={!!c.pessoaId} />
                    <FotoField label="Foto do rosto" value={c.foto ?? null} onChange={(f) => updAcompanhante(i, { foto: f })} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none border-t p-3 bg-slate-50 grid grid-cols-2 gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={voltar} disabled={saving} className="h-12"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
          ) : (
            <Button variant="outline" onClick={onClose} disabled={saving} className="h-12">Cancelar</Button>
          )}
          {step < 4 ? (
            <Button onClick={irParaProximo} className="h-12 bg-emerald-600 hover:bg-emerald-700">
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => finalizar.mutate()} disabled={saving || (pessoaExistente?.bloqueado ?? false)} className="h-12 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} Registrar Entrada
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FotoField({ label, value, onChange, fallbackHint }: { label: string; value: File | null; onChange: (f: File | null) => void; fallbackHint?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  return (
    <div>
      <Label className="text-xs font-black uppercase tracking-widest">{label}</Label>
      {fallbackHint && <p className="text-[10px] text-slate-500 mt-0.5">{fallbackHint}</p>}
      <label className="mt-1 flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-3 cursor-pointer hover:border-emerald-400 bg-white">
        {preview
          ? <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
          : <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center"><Camera className="h-6 w-6 text-slate-400" /></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-700">{preview ? "Foto capturada" : "Toque para capturar"}</p>
          <p className="text-[10px] text-slate-500 truncate">{value?.name ?? "Câmera traseira será usada"}</p>
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}
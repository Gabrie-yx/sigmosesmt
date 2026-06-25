import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, X, Plus } from "lucide-react";

export type Prestador = {
  id?: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  contato_responsavel: string | null;
  especialidades: string[];
  tipos_guia_esocial: string[];
  horario_atendimento: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const TIPOS_ESOCIAL = [
  "Admissional", "Periódico", "Demissional", "Mudança de Risco", "Retorno ao Trabalho", "Monitoração Pontual",
];
const ESPECIALIDADES_SUG = [
  "Clínico", "Audiometria", "Espirometria", "Acuidade Visual", "EEG", "ECG",
  "Hemograma", "Raio-X", "Imagem", "Ergonômico", "Psicológico", "Toxicológico",
];

function emptyPrestador(): Prestador {
  return {
    razao_social: "", nome_fantasia: null, cnpj: null,
    cep: null, logradouro: null, numero: null, complemento: null,
    bairro: null, cidade: null, uf: null,
    telefone: null, email: null, contato_responsavel: null,
    especialidades: [], tipos_guia_esocial: [],
    horario_atendimento: null, observacoes: null, ativo: true,
  };
}

function maskCnpj(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function PrestadorDialog({
  open, onOpenChange, prestador,
}: { open: boolean; onOpenChange: (b: boolean) => void; prestador?: Prestador | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Prestador>(emptyPrestador());
  const [cepLoading, setCepLoading] = useState(false);
  const [newEspec, setNewEspec] = useState("");

  useEffect(() => {
    if (open) setForm(prestador ? { ...prestador } : emptyPrestador());
  }, [open, prestador]);

  async function buscaCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (d?.erro) { toast.error("CEP não encontrado"); return; }
      setForm((f) => ({
        ...f,
        logradouro: d.logradouro || f.logradouro,
        bairro: d.bairro || f.bairro,
        cidade: d.localidade || f.cidade,
        uf: d.uf || f.uf,
      }));
    } catch { toast.error("Falha ao buscar CEP"); }
    finally { setCepLoading(false); }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.razao_social.trim()) throw new Error("Razão social obrigatória");
      const payload = { ...form, razao_social: form.razao_social.trim() };
      if (form.id) {
        const { error } = await supabase.from("prestadores_saude").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prestadores_saude").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Prestador atualizado" : "Prestador cadastrado");
      qc.invalidateQueries({ queryKey: ["prestadores-saude"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleTipo(t: string) {
    setForm((f) => ({
      ...f,
      tipos_guia_esocial: f.tipos_guia_esocial.includes(t)
        ? f.tipos_guia_esocial.filter((x) => x !== t)
        : [...f.tipos_guia_esocial, t],
    }));
  }
  function addEspec(v: string) {
    const val = v.trim();
    if (!val || form.especialidades.includes(val)) return;
    setForm((f) => ({ ...f, especialidades: [...f.especialidades, val] }));
    setNewEspec("");
  }
  function rmEspec(v: string) {
    setForm((f) => ({ ...f, especialidades: f.especialidades.filter((x) => x !== v) }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950/95 backdrop-blur-xl border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{form.id ? "Editar prestador" : "Novo prestador de saúde"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Clínica ou laboratório usado em convocações de ASO e guias de encaminhamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Identificação */}
          <section className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Identificação</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Razão social *</Label>
                <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
              </div>
              <div>
                <Label className="text-slate-300">Nome fantasia</Label>
                <Input value={form.nome_fantasia ?? ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">CNPJ</Label>
                <Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.ativo} onCheckedChange={(b) => setForm({ ...form, ativo: b })} id="ativo" />
                <Label htmlFor="ativo" className="text-slate-300">Ativo</Label>
              </div>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Endereço</h3>
            <div className="grid sm:grid-cols-[140px_1fr_120px] gap-3">
              <div>
                <Label className="text-slate-300">CEP</Label>
                <div className="relative">
                  <Input
                    value={form.cep ?? ""}
                    onChange={(e) => setForm({ ...form, cep: maskCep(e.target.value) })}
                    onBlur={(e) => buscaCep(e.target.value)}
                    placeholder="00000-000"
                  />
                  {cepLoading && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Logradouro</Label>
                <Input value={form.logradouro ?? ""} onChange={(e) => setForm({ ...form, logradouro: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">Nº</Label>
                <Input value={form.numero ?? ""} onChange={(e) => setForm({ ...form, numero: e.target.value || null })} />
              </div>
            </div>
            <div className="grid sm:grid-cols-[1fr_1fr_1fr_80px] gap-3">
              <div>
                <Label className="text-slate-300">Complemento</Label>
                <Input value={form.complemento ?? ""} onChange={(e) => setForm({ ...form, complemento: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">Bairro</Label>
                <Input value={form.bairro ?? ""} onChange={(e) => setForm({ ...form, bairro: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">Cidade</Label>
                <Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">UF</Label>
                <Input maxLength={2} value={form.uf ?? ""} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() || null })} />
              </div>
            </div>
          </section>

          {/* Contato */}
          <section className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Contato</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-slate-300">Telefone</Label>
                <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">E-mail</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-slate-300">Responsável</Label>
                <Input value={form.contato_responsavel ?? ""} onChange={(e) => setForm({ ...form, contato_responsavel: e.target.value || null })} />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Horário de atendimento</Label>
              <Input value={form.horario_atendimento ?? ""} onChange={(e) => setForm({ ...form, horario_atendimento: e.target.value || null })} placeholder="Seg a Sex, 7h às 17h" />
            </div>
          </section>

          {/* Especialidades */}
          <section className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Especialidades / Exames atendidos</h3>
            <div className="flex flex-wrap gap-1.5">
              {form.especialidades.map((e) => (
                <Badge key={e} className="bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30 gap-1">
                  {e}
                  <button onClick={() => rmEspec(e)} className="hover:text-white"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newEspec}
                onChange={(e) => setNewEspec(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEspec(newEspec); } }}
                placeholder="Adicionar especialidade"
              />
              <Button type="button" variant="outline" onClick={() => addEspec(newEspec)}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ESPECIALIDADES_SUG.filter((s) => !form.especialidades.includes(s)).map((s) => (
                <button key={s} onClick={() => addEspec(s)} className="text-xs px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10">
                  + {s}
                </button>
              ))}
            </div>
          </section>

          {/* Tipos eSocial */}
          <section className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Tipos de Guia eSocial</h3>
            <div className="flex flex-wrap gap-2">
              {TIPOS_ESOCIAL.map((t) => {
                const on = form.tipos_guia_esocial.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTipo(t)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition ${
                      on ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </section>

          <div>
            <Label className="text-slate-300">Observações</Label>
            <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
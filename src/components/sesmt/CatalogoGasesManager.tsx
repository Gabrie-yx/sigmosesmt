import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Wind, Plus, Pencil, Trash2, ShieldCheck, Save, X } from "lucide-react";
import { toast } from "sonner";

type Gas = {
  id: string;
  nome: string;
  simbolo: string;
  unidade: string;
  limite_min: number | null;
  limite_max: number | null;
  descricao_limite: string | null;
  ordem: number;
  ativo: boolean;
  is_padrao_nr33: boolean;
};

type FormState = {
  id: string | null;
  nome: string;
  simbolo: string;
  unidade: string;
  limite_min: string;
  limite_max: string;
  descricao_limite: string;
  ordem: string;
  ativo: boolean;
};

const empty: FormState = {
  id: null,
  nome: "",
  simbolo: "",
  unidade: "ppm",
  limite_min: "",
  limite_max: "",
  descricao_limite: "",
  ordem: "99",
  ativo: true,
};

export function CatalogoGasesManager({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { isModerator, isAdmin } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState(false);

  const { data: gases = [], isLoading } = useQuery({
    queryKey: ["catalogo-gases-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_gases_atmosfericos")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Gas[];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["catalogo-gases-all"] });
    qc.invalidateQueries({ queryKey: ["catalogo-gases-ativos"] });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim() || !form.simbolo.trim() || !form.unidade.trim())
        throw new Error("Nome, símbolo e unidade são obrigatórios");
      const payload = {
        nome: form.nome.trim(),
        simbolo: form.simbolo.trim(),
        unidade: form.unidade.trim(),
        limite_min: form.limite_min === "" ? null : Number(form.limite_min),
        limite_max: form.limite_max === "" ? null : Number(form.limite_max),
        descricao_limite: form.descricao_limite.trim() || null,
        ordem: form.ordem === "" ? 99 : Number(form.ordem),
        ativo: form.ativo,
      };
      if (form.id) {
        const { error } = await supabase
          .from("catalogo_gases_atmosfericos")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalogo_gases_atmosfericos")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Gás atualizado" : "Gás cadastrado");
      setForm(empty);
      setEditing(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (g: Gas) => {
      const { error } = await supabase
        .from("catalogo_gases_atmosfericos")
        .update({ ativo: !g.ativo })
        .eq("id", g.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Sem permissão"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalogo_gases_atmosfericos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gás removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Apenas admins podem excluir"),
  });

  function startEdit(g: Gas) {
    setForm({
      id: g.id,
      nome: g.nome,
      simbolo: g.simbolo,
      unidade: g.unidade,
      limite_min: g.limite_min?.toString() ?? "",
      limite_max: g.limite_max?.toString() ?? "",
      descricao_limite: g.descricao_limite ?? "",
      ordem: g.ordem.toString(),
      ativo: g.ativo,
    });
    setEditing(true);
  }

  function cancel() {
    setForm(empty);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/60 px-4 py-3 text-[11px] font-bold text-cyan-900">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-wider">Catálogo de Gases Atmosféricos (NR-33)</span>
          </div>
          Os 4 gases padrão NR-33 (O₂, LIE, H₂S, CO) já estão cadastrados. Adicione outros conforme o risco
          do espaço confinado (ex: NH₃, SO₂, CO₂). Apenas <b>SESMT/Eng. Segurança</b> pode editar.
        </div>
      )}

      {/* Lista */}
      <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Símbolo</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Unidade</th>
              <th className="px-3 py-2 text-left">Limites</th>
              <th className="px-3 py-2 text-left">Ativo</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">Carregando…</td></tr>
            )}
            {!isLoading && gases.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">Nenhum gás cadastrado</td></tr>
            )}
            {gases.map((g) => (
              <tr key={g.id} className={`border-t ${!g.ativo ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 font-bold text-slate-600">{g.ordem}</td>
                <td className="px-3 py-2">
                  <span className="font-black text-slate-800">{g.simbolo}</span>
                  {g.is_padrao_nr33 && (
                    <span className="ml-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-700 text-white">NR-33</span>
                  )}
                </td>
                <td className="px-3 py-2 font-bold">{g.nome}</td>
                <td className="px-3 py-2">{g.unidade}</td>
                <td className="px-3 py-2 text-[11px]">
                  {g.limite_min !== null && <span>≥{g.limite_min} </span>}
                  {g.limite_max !== null && <span>≤{g.limite_max}</span>}
                  {g.descricao_limite && <div className="text-[9px] text-slate-500">{g.descricao_limite}</div>}
                </td>
                <td className="px-3 py-2">
                  <Switch
                    checked={g.ativo}
                    disabled={!isModerator || toggleAtivo.isPending}
                    onCheckedChange={() => toggleAtivo.mutate(g)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {isModerator && (
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEdit(g)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {isAdmin && !g.is_padrao_nr33 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`Excluir "${g.nome}"?`)) remove.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form */}
      {isModerator && (
        <div className="rounded-xl border-2 border-cyan-400 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-cyan-700" />
              <h4 className="text-xs font-black uppercase tracking-widest text-cyan-900">
                {editing ? "Editar Gás" : "Novo Gás"}
              </h4>
            </div>
            {editing && (
              <Button size="sm" variant="ghost" onClick={cancel} className="h-7">
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Símbolo *</Label>
              <Input value={form.simbolo} onChange={(e) => setForm({ ...form, simbolo: e.target.value })} placeholder="Ex: NH₃" className="h-9 text-xs" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[10px] font-black uppercase text-slate-600">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Amônia" className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Unidade *</Label>
              <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="ppm / % / mg/m³" className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Limite Mín.</Label>
              <Input type="number" step="0.1" value={form.limite_min} onChange={(e) => setForm({ ...form, limite_min: e.target.value })} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Limite Máx.</Label>
              <Input type="number" step="0.1" value={form.limite_max} onChange={(e) => setForm({ ...form, limite_max: e.target.value })} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-slate-600">Ordem</Label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} className="h-9 text-xs" />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label className="text-[10px] font-black uppercase text-slate-600">Ativo</Label>
            </div>
            <div className="col-span-full">
              <Label className="text-[10px] font-black uppercase text-slate-600">Descrição do limite (NR/referência)</Label>
              <Input
                value={form.descricao_limite}
                onChange={(e) => setForm({ ...form, descricao_limite: e.target.value })}
                placeholder="Ex: NR-33 item 33.3.4.4"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-cyan-700 hover:bg-cyan-800 text-white text-[10px] font-black uppercase tracking-wider"
            >
              {editing ? <Save className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              {editing ? "Salvar Alterações" : "Cadastrar Gás"}
            </Button>
          </div>
        </div>
      )}

      {!isModerator && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-[11px] font-bold text-amber-900">
          Apenas SESMT/Eng. Segurança (moderador ou admin) pode cadastrar/editar gases.
        </div>
      )}
    </div>
  );
}
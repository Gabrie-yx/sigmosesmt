import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listUsersAdmin } from "@/lib/users.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

type Marcador = {
  user_id: string;
  nome: string;
  ativo: boolean;
  escopo: any;
  self_employee_id: string | null;
};

type EscopoTipo = "TUDO" | "SETOR" | "SELF" | "EMPRESA_TERCEIRA" | "DMN_APOIO";

const TIPO_LABEL: Record<EscopoTipo, string> = {
  TUDO: "Marca todo mundo (Manoel)",
  SETOR: "Setor(es) — ex: elétrica (Natanael)",
  SELF: "Só ele mesmo (Paulo Sérgio)",
  EMPRESA_TERCEIRA: "Empresa(s) terceirizada(s) (Renato/LF)",
  DMN_APOIO: "DMN direto — setores de apoio (Daniel)",
};

export function MarcadoresManagerDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const listUsers = useServerFn(listUsersAdmin);

  const marcadoresQ = useQuery({
    queryKey: ["hora-extra-marcadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_marcadores")
        .select("user_id, nome, ativo, escopo, self_employee_id")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Marcador[];
    },
    enabled: open,
  });

  const usersQ = useQuery({
    queryKey: ["users-admin-for-marcadores"],
    queryFn: async () => (await listUsers()).users,
    enabled: open,
  });

  const empresasQ = useQuery({
    queryKey: ["empresas-terceiras-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_terceiras")
        .select("id, razao_social, nome_fantasia")
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const employeesQ = useQuery({
    queryKey: ["employees-lite-marcadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, setor")
        .eq("status", "ATIVO")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const [novoUserId, setNovoUserId] = useState("");
  const [novoTipo, setNovoTipo] = useState<EscopoTipo>("SETOR");
  const [novoSetores, setNovoSetores] = useState("");
  const [novoEmpresas, setNovoEmpresas] = useState<string[]>([]);
  const [novoSelfEmpId, setNovoSelfEmpId] = useState("");

  function resetForm() {
    setNovoUserId(""); setNovoTipo("SETOR"); setNovoSetores("");
    setNovoEmpresas([]); setNovoSelfEmpId("");
  }

  function buildEscopo(tipo: EscopoTipo): any {
    if (tipo === "TUDO") return { tipo: "TUDO" };
    if (tipo === "SELF") return { tipo: "SELF" };
    if (tipo === "SETOR") {
      const vals = novoSetores.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
      return { tipo: "SETOR", valores: vals };
    }
    if (tipo === "DMN_APOIO") {
      const vals = novoSetores.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
      return { tipo: "DMN_APOIO", setores: vals };
    }
    if (tipo === "EMPRESA_TERCEIRA") return { tipo: "EMPRESA_TERCEIRA", ids: novoEmpresas };
    return { tipo: "SELF" };
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!novoUserId) throw new Error("Escolha o usuário");
      const u = usersQ.data?.find(x => x.id === novoUserId);
      const nome = u?.full_name || u?.email || "Marcador";
      const escopo = buildEscopo(novoTipo);
      if (novoTipo === "SETOR" && (!escopo.valores?.length)) throw new Error("Informe ao menos 1 setor");
      if (novoTipo === "DMN_APOIO" && (!escopo.setores?.length)) throw new Error("Informe ao menos 1 setor");
      if (novoTipo === "EMPRESA_TERCEIRA" && (!escopo.ids?.length)) throw new Error("Escolha ao menos 1 empresa");
      if (novoTipo === "SELF" && !novoSelfEmpId) throw new Error("Vincule o funcionário dele");

      // upsert marcador
      const { error: e1 } = await supabase.from("hora_extra_marcadores").upsert({
        user_id: novoUserId,
        nome,
        ativo: true,
        escopo,
        self_employee_id: novoTipo === "SELF" ? novoSelfEmpId : null,
      });
      if (e1) throw e1;

      // garante role extra_sabado_marcador
      const { error: e2 } = await supabase.from("user_roles").upsert(
        { user_id: novoUserId, role: "extra_sabado_marcador" as any },
        { onConflict: "user_id,role" }
      );
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Marcador cadastrado");
      qc.invalidateQueries({ queryKey: ["hora-extra-marcadores"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { error } = await supabase.from("hora_extra_marcadores")
        .update({ ativo }).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hora-extra-marcadores"] }),
  });

  const remover = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase.from("hora_extra_marcadores").delete().eq("user_id", user_id);
      if (error) throw error;
      // remove o role também
      await supabase.from("user_roles").delete()
        .eq("user_id", user_id).eq("role", "extra_sabado_marcador" as any);
    },
    onSuccess: () => {
      toast.success("Marcador removido");
      qc.invalidateQueries({ queryKey: ["hora-extra-marcadores"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const usuariosDisponiveis = useMemo(() => {
    const jaMarcadores = new Set((marcadoresQ.data ?? []).map(m => m.user_id));
    return (usersQ.data ?? []).filter(u => !jaMarcadores.has(u.id) && !u.suspended);
  }, [usersQ.data, marcadoresQ.data]);

  function escopoResumo(m: Marcador): string {
    const e = m.escopo || {};
    if (e.tipo === "TUDO") return "Todo mundo";
    if (e.tipo === "SELF") return "Só ele mesmo";
    if (e.tipo === "SETOR") return `Setores: ${(e.valores ?? []).join(", ")}`;
    if (e.tipo === "DMN_APOIO") return `DMN apoio: ${(e.setores ?? []).join(", ")}`;
    if (e.tipo === "EMPRESA_TERCEIRA") {
      const nomes = (e.ids ?? []).map((id: string) =>
        empresasQ.data?.find(x => x.id === id)?.nome_fantasia
        || empresasQ.data?.find(x => x.id === id)?.razao_social
        || id.slice(0, 6)
      );
      return `Terceiras: ${nomes.join(", ")}`;
    }
    return "—";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Marcadores — Extra de Sábado
          </DialogTitle>
          <DialogDescription>
            Cadastre quem pode marcar presença pelo painel mobile e o escopo de cada um.
            Só admin/TST gerencia. Cada marcador só enxerga e mexe no que está no escopo.
          </DialogDescription>
        </DialogHeader>

        {/* Lista atual */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Cadastrados</h3>
          {marcadoresQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (marcadoresQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum marcador ainda.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {marcadoresQ.data!.map(m => (
                <li key={m.user_id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{m.nome}</span>
                      {!m.ativo && <Badge variant="outline">inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{escopoResumo(m)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={m.ativo}
                      onCheckedChange={(v) => toggleAtivo.mutate({ user_id: m.user_id, ativo: v })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (confirm(`Remover ${m.nome} dos marcadores?`)) remover.mutate(m.user_id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Form novo */}
        <div className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">Adicionar marcador</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Usuário</Label>
              <Select value={novoUserId} onValueChange={setNovoUserId}>
                <SelectTrigger><SelectValue placeholder="Escolha o usuário…" /></SelectTrigger>
                <SelectContent>
                  {usuariosDisponiveis.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email} <span className="text-muted-foreground">— {u.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Não achou? Cadastre em Usuários primeiro.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Escopo</Label>
              <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as EscopoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABEL) as EscopoTipo[]).map(t => (
                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(novoTipo === "SETOR" || novoTipo === "DMN_APOIO") && (
            <div className="space-y-1">
              <Label>Setores (separados por vírgula)</Label>
              <Input
                value={novoSetores}
                onChange={(e) => setNovoSetores(e.target.value)}
                placeholder={novoTipo === "SETOR" ? "ELETRICA" : "ALMOX, SG, ADM, PORTARIA"}
              />
              <p className="text-[11px] text-muted-foreground">
                Use exatamente como está cadastrado em Funcionários (caixa alta).
              </p>
            </div>
          )}

          {novoTipo === "EMPRESA_TERCEIRA" && (
            <div className="space-y-1">
              <Label>Empresas terceirizadas</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                {(empresasQ.data ?? []).map(emp => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={novoEmpresas.includes(emp.id)}
                      onChange={(e) => {
                        setNovoEmpresas(prev => e.target.checked
                          ? [...prev, emp.id]
                          : prev.filter(x => x !== emp.id));
                      }}
                    />
                    <span>{emp.nome_fantasia || emp.razao_social}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {novoTipo === "SELF" && (
            <div className="space-y-1">
              <Label>Vincular ao funcionário</Label>
              <Select value={novoSelfEmpId} onValueChange={setNovoSelfEmpId}>
                <SelectTrigger><SelectValue placeholder="Escolha o funcionário…" /></SelectTrigger>
                <SelectContent>
                  {(employeesQ.data ?? []).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} {e.setor ? `— ${e.setor}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Cadastrar marcador
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Users, Plus, Star as StarIcon, Pencil, Award,
} from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "@/components/compras/star-rating";

export const Route = createFileRoute("/app/compras/fornecedores")({
  component: FornecedoresPage,
});

type Fornecedor = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  bp: string | null;
  tipo: "MATERIAL" | "SERVICO";
  produto: string | null;
  responsavel: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  centro_custo: string | null;
  estrelas: number;
  observacoes_avaliacao: string | null;
  ativo: boolean;
  updated_at: string;
};

function FornecedoresPage() {
  const { user, roles, hasModule } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCompras = isAdmin || roles.includes("compras" as any) || hasModule("compras" as any);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"TODOS" | "MATERIAL" | "SERVICO">("TODOS");
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    enabled: !!user && isCompras,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("estrelas", { ascending: false })
        .order("nome_fantasia")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Fornecedor[];
    },
  });

  const filtered = useMemo(() => {
    return fornecedores.filter((f) => {
      if (tab !== "TODOS" && f.tipo !== tab) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        f.nome_fantasia.toLowerCase().includes(s) ||
        (f.razao_social ?? "").toLowerCase().includes(s) ||
        (f.cnpj ?? "").includes(s) ||
        (f.produto ?? "").toLowerCase().includes(s)
      );
    });
  }, [fornecedores, q, tab]);

  const totMat = fornecedores.filter((f) => f.tipo === "MATERIAL").length;
  const totSrv = fornecedores.filter((f) => f.tipo === "SERVICO").length;
  const top = fornecedores.filter((f) => f.estrelas >= 4).length;

  if (!user) return null;
  if (!isCompras) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">Restrito ao módulo Compras.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Fornecedores Qualificados</h1>
            <p className="text-xs text-slate-500">
              Base FOR-COMP-02 · avaliação por estrelas alimenta a matriz de decisão das cotações
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-slate-100 text-slate-700 border">Total: {fornecedores.length}</Badge>
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">Material: {totMat}</Badge>
          <Badge className="bg-violet-100 text-violet-800 border-violet-300">Serviço: {totSrv}</Badge>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            <Award className="h-3 w-3 mr-1" /> Top (4-5★): {top}
          </Badge>
          <Button size="sm" onClick={() => setCreating(true)} className="bg-red-700 hover:bg-red-800 text-white">
            <Plus className="h-4 w-4 mr-1" /> Novo fornecedor
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CNPJ, produto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="TODOS">Todos</TabsTrigger>
              <TabsTrigger value="MATERIAL">Materiais</TabsTrigger>
              <TabsTrigger value="SERVICO">Serviços</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-500 border rounded-xl bg-white">
          Nenhum fornecedor encontrado.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs">
              <tr>
                <th className="p-2 text-left">Fornecedor</th>
                <th className="p-2 text-left w-28">Tipo</th>
                <th className="p-2 text-left">Produto/Serviço</th>
                <th className="p-2 text-left w-40">CNPJ</th>
                <th className="p-2 text-center w-40">Avaliação</th>
                <th className="p-2 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <FornecedorRow key={f.id} f={f} onEdit={() => setEditing(f)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditFornecedorDialog f={editing} onClose={() => setEditing(null)} />
      )}
      {creating && (
        <EditFornecedorDialog f={null} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function FornecedorRow({ f, onEdit }: { f: Fornecedor; onEdit: () => void }) {
  const qc = useQueryClient();
  const setStars = useMutation({
    mutationFn: async (n: number) => {
      const { error } = await supabase
        .from("fornecedores")
        .update({
          estrelas: n,
          estrelas_atualizado_em: new Date().toISOString(),
        } as any)
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação atualizada");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      qc.invalidateQueries({ queryKey: ["fornecedores-picker"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="p-2">
        <div className="font-semibold">{f.nome_fantasia}</div>
        {f.razao_social && <div className="text-[11px] text-slate-500">{f.razao_social}</div>}
      </td>
      <td className="p-2">
        <Badge className={f.tipo === "MATERIAL"
          ? "bg-blue-100 text-blue-800 border border-blue-300"
          : "bg-violet-100 text-violet-800 border border-violet-300"
        }>
          {f.tipo === "MATERIAL" ? "Material" : "Serviço"}
        </Badge>
      </td>
      <td className="p-2 text-slate-700">{f.produto ?? "—"}</td>
      <td className="p-2 text-xs text-slate-600">{f.cnpj ?? "—"}</td>
      <td className="p-2">
        <div className="flex flex-col items-center gap-0.5">
          <StarRating value={f.estrelas} onChange={(n) => setStars.mutate(n)} size="md" />
          <span className="text-[10px] text-slate-500">{f.estrelas}/5</span>
        </div>
      </td>
      <td className="p-2 text-right">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function EditFornecedorDialog({ f, onClose }: { f: Fornecedor | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !f;
  const [nome, setNome] = useState(f?.nome_fantasia ?? "");
  const [razao, setRazao] = useState(f?.razao_social ?? "");
  const [cnpj, setCnpj] = useState(f?.cnpj ?? "");
  const [bp, setBp] = useState(f?.bp ?? "");
  const [tipo, setTipo] = useState<"MATERIAL" | "SERVICO">(f?.tipo ?? "MATERIAL");
  const [produto, setProduto] = useState(f?.produto ?? "");
  const [responsavel, setResponsavel] = useState(f?.responsavel ?? "");
  const [telefone, setTelefone] = useState(f?.telefone ?? "");
  const [email, setEmail] = useState(f?.email ?? "");
  const [endereco, setEndereco] = useState(f?.endereco ?? "");
  const [centroCusto, setCentroCusto] = useState(f?.centro_custo ?? "");
  const [estrelas, setEstrelas] = useState(f?.estrelas ?? 3);
  const [obs, setObs] = useState(f?.observacoes_avaliacao ?? "");
  const [ativo, setAtivo] = useState(f?.ativo ?? true);

  const save = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome fantasia é obrigatório");
      const payload: any = {
        nome_fantasia: nome.trim(),
        razao_social: razao.trim() || null,
        cnpj: cnpj.trim() || null,
        bp: bp.trim() || null,
        tipo,
        produto: produto.trim() || null,
        responsavel: responsavel.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        centro_custo: centroCusto.trim() || null,
        estrelas,
        observacoes_avaliacao: obs.trim() || null,
        ativo,
        estrelas_atualizado_em: new Date().toISOString(),
      };
      if (isNew) {
        const { error } = await supabase.from("fornecedores").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", f!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Fornecedor cadastrado" : "Alterações salvas");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      qc.invalidateQueries({ queryKey: ["fornecedores-picker"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Cadastrar fornecedor" : `Editar: ${f!.nome_fantasia}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome fantasia *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Razão social</Label>
              <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
            <div>
              <Label>BP</Label>
              <Input value={bp} onChange={(e) => setBp(e.target.value)} />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MATERIAL">Material</SelectItem>
                  <SelectItem value="SERVICO">Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Centro de custo</Label>
              <Input value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Produto / serviço principal</Label>
            <Input value={produto} onChange={(e) => setProduto(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </div>
          <div className="border-t pt-3">
            <Label className="flex items-center gap-1">
              <StarIcon className="h-4 w-4 text-amber-500" /> Avaliação para a matriz
            </Label>
            <div className="flex items-center gap-3 mt-1">
              <StarRating value={estrelas} onChange={setEstrelas} size="lg" />
              <span className="text-sm font-semibold">{estrelas}/5</span>
            </div>
            <Textarea
              className="mt-2"
              rows={2}
              placeholder="Notas de avaliação (qualidade, atrasos, sinistros…)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="ativo"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="ativo" className="cursor-pointer">Fornecedor ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-red-700 hover:bg-red-800 text-white"
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
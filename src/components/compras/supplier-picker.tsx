import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "./star-rating";
import { cn } from "@/lib/utils";

export type SupplierLite = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  estrelas: number;
  tipo: string;
  produto: string | null;
};

export function SupplierPicker({
  value,
  onChange,
  tipo,
}: {
  value: SupplierLite | null;
  onChange: (s: SupplierLite | null) => void;
  tipo?: "MATERIAL" | "SERVICO";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["fornecedores-picker", tipo],
    queryFn: async () => {
      let query = supabase
        .from("fornecedores")
        .select("id,nome_fantasia,razao_social,cnpj,estrelas,tipo,produto")
        .eq("ativo", true)
        .order("estrelas", { ascending: false })
        .order("nome_fantasia")
        .limit(500);
      if (tipo) query = query.eq("tipo", tipo);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SupplierLite[];
    },
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return suppliers;
    const s = q.toLowerCase();
    return suppliers.filter(
      (f) =>
        f.nome_fantasia.toLowerCase().includes(s) ||
        (f.razao_social ?? "").toLowerCase().includes(s) ||
        (f.cnpj ?? "").includes(s) ||
        (f.produto ?? "").toLowerCase().includes(s),
    );
  }, [suppliers, q]);

  return (
    <>
      <div>
        <Label>Fornecedor *</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between font-normal h-10"
            >
              {value ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-semibold">{value.nome_fantasia}</span>
                  <StarRating value={value.estrelas} size="sm" readOnly />
                </span>
              ) : (
                <span className="text-slate-500">Selecione um fornecedor qualificado…</span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[420px] max-w-[95vw] bg-popover text-popover-foreground border-border shadow-xl backdrop-blur-md"
            align="start"
          >
            <div className="p-2 border-b border-border flex gap-2 items-center bg-popover/60">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                autoFocus
                placeholder="Buscar por nome, CNPJ, produto…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 bg-transparent border-border"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </div>
              ) : (
                filtered.map((f) => {
                  const active = value?.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onChange(f);
                        setOpen(false);
                        setQ("");
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 flex items-start gap-2 transition-colors",
                        active && "bg-primary/15",
                      )}
                    >
                      <Check className={cn("h-4 w-4 mt-0.5 shrink-0", active ? "text-primary" : "text-transparent")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{f.nome_fantasia}</span>
                          <StarRating value={f.estrelas} size="sm" readOnly />
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {f.cnpj ?? "sem CNPJ"} · {f.produto ?? f.tipo}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-2 border-t border-border bg-muted/40">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => { setOpen(false); setCreating(true); }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar novo fornecedor
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {value && (
          <div className="text-[11px] text-muted-foreground mt-1">
            {value.razao_social ?? "—"} · CNPJ {value.cnpj ?? "—"}
          </div>
        )}
      </div>

      {creating && (
        <CreateSupplierDialog
          defaultTipo={tipo}
          onClose={() => setCreating(false)}
          onCreated={(s) => { onChange(s); setCreating(false); }}
        />
      )}
    </>
  );
}

function CreateSupplierDialog({
  onClose, onCreated, defaultTipo,
}: {
  onClose: () => void;
  onCreated: (s: SupplierLite) => void;
  defaultTipo?: "MATERIAL" | "SERVICO";
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tipo, setTipo] = useState<"MATERIAL" | "SERVICO">(defaultTipo ?? "MATERIAL");
  const [produto, setProduto] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [estrelas, setEstrelas] = useState(3);

  const create = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome é obrigatório");
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({
          nome_fantasia: nome.trim(),
          razao_social: razao.trim() || null,
          cnpj: cnpj.trim() || null,
          tipo,
          produto: produto.trim() || null,
          responsavel: responsavel.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          estrelas,
        } as any)
        .select("id,nome_fantasia,razao_social,cnpj,estrelas,tipo,produto")
        .single();
      if (error) throw error;
      return data as SupplierLite;
    },
    onSuccess: (s) => {
      toast.success("Fornecedor cadastrado");
      qc.invalidateQueries({ queryKey: ["fornecedores-picker"] });
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      onCreated(s);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao cadastrar"),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar novo fornecedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome fantasia *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Razão social</Label>
            <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                className="w-full h-10 border rounded-md px-3 text-sm"
              >
                <option value="MATERIAL">Material</option>
                <option value="SERVICO">Serviço</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Produto / serviço principal</Label>
            <Input value={produto} onChange={(e) => setProduto(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Avaliação inicial</Label>
            <div className="flex items-center gap-2">
              <StarRating value={estrelas} onChange={setEstrelas} size="lg" />
              <span className="text-xs text-slate-500">{estrelas}/5</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !nome.trim()}
            className="bg-red-700 hover:bg-red-800 text-white"
          >
            {create.isPending ? "Salvando…" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
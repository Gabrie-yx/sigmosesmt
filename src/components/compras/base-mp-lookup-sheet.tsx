import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Boxes, Search, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import type { PickedItem } from "@/components/estoque-lookup-sheet";

type BaseMpRow = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: string;
  ativo: boolean;
};

type Props = {
  triggerLabel?: string;
  onPick?: (item: PickedItem) => void;
};

export function BaseMpLookupSheet({ triggerLabel = "Consultar Base de Matéria-Prima", onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["base_mp_lookup"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_base_materia_prima")
        .select("id, codigo, descricao, tipo, ativo")
        .eq("ativo", true)
        .order("descricao");
      if (error) throw error;
      return (data ?? []) as BaseMpRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) =>
      [i.codigo, i.descricao, i.tipo].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [items, q]);

  const usar = (i: BaseMpRow) => {
    if (!onPick) return;
    onPick({
      descricao: `${i.descricao ?? i.codigo}`.trim(),
      unidade: "UN",
      ca: null,
    });
    toast.success("Item inserido na requisição");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Boxes className="h-4 w-4 text-red-700" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-red-700" /> Base de Matéria-Prima
          </SheetTitle>
          <SheetDescription>
            Pesquise por descrição, código ou tipo (FERRO / GÁS / SOLDA / TINTA).
          </SheetDescription>
          <div className="relative pt-2">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              placeholder="Buscar material, código ou tipo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground p-4">Carregando base...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-sm text-muted-foreground p-6 text-center">Nenhum item encontrado.</div>
          )}
          {filtered.map((i) => (
            <div
              key={i.id}
              className="rounded-lg border border-border bg-card text-card-foreground p-2.5 flex gap-3 transition-colors hover:border-red-400/60 hover:bg-red-500/10"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {i.descricao ?? i.codigo}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-border text-foreground/80">
                    Cód. {i.codigo}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-red-500/40 bg-red-500/15 text-red-200"
                  >
                    {i.tipo}
                  </Badge>
                </div>
                {onPick && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2 bg-red-700 hover:bg-red-800 text-white"
                      onClick={() => usar(i)}
                    >
                      <ArrowDownToLine className="h-3 w-3 mr-1" /> Usar na requisição
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Fonte de sugestões para o autocomplete da descrição do item de RC.
 * Combina Base MP (produção) + últimas descrições usadas em RCs anteriores.
 */
export async function suggestFromBaseMpAndHistorico(q: string): Promise<{ descricao: string; unidade?: string | null }[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const [{ data: base }, { data: hist }] = await Promise.all([
    supabase
      .from("producao_base_materia_prima")
      .select("codigo, descricao, tipo")
      .eq("ativo", true)
      .or(`descricao.ilike.%${term}%,codigo.ilike.%${term}%`)
      .limit(15),
    supabase
      .from("purchase_requisition_items")
      .select("descricao, unidade")
      .ilike("descricao", `%${term}%`)
      .limit(15),
  ]);

  const seen = new Set<string>();
  const out: { descricao: string; unidade?: string | null }[] = [];

  for (const r of base ?? []) {
    const desc = (r.descricao ?? r.codigo).trim();
    const key = desc.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push({ descricao: desc }); }
  }
  for (const r of hist ?? []) {
    const desc = (r.descricao ?? "").trim();
    if (!desc) continue;
    const key = desc.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push({ descricao: desc, unidade: r.unidade }); }
  }
  return out;
}
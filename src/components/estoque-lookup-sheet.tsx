import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Boxes, Search, Copy, ArrowDownToLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";

type EstoqueItem = {
  id: string;
  codigo_material: string;
  nome_material: string;
  ca: string | null;
  ca_validade: string | null;
  quantidade_atual: number;
  estoque_minimo: number;
  ultimo_fornecedor: string | null;
  imagem_url: string | null;
};

export type PickedItem = {
  descricao: string;
  unidade: string;
  ca: string | null;
};

type Props = {
  triggerLabel?: string;
  onPick?: (item: PickedItem) => void;
  /** Quando true, abre como Sheet sobreposto. Disparador inline. */
  align?: "right" | "left";
};

export function EstoqueLookupSheet({ triggerLabel = "Consultar Estoque SESMT", onPick, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["estoque_epi_lookup"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, codigo_material, nome_material, ca, ca_validade, quantidade_atual, estoque_minimo, ultimo_fornecedor, imagem_url")
        .order("nome_material");
      if (error) throw error;
      return (data ?? []) as EstoqueItem[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) =>
      [i.codigo_material, i.nome_material, i.ca, i.ultimo_fornecedor]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [items, q]);

  const today = new Date().toISOString().slice(0, 10);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const usar = (i: EstoqueItem) => {
    if (!onPick) return;
    const ca = i.ca ? ` — CA ${i.ca}` : "";
    onPick({
      descricao: `${i.nome_material}${ca}`.trim(),
      unidade: "UN",
      ca: i.ca,
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
      <SheetContent
        side={align}
        className="w-full sm:max-w-2xl p-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-red-700" /> Consulta Rápida — Estoque SESMT
          </SheetTitle>
          <SheetDescription>
            Pesquise por nome, código ou CA. Use sem fechar a requisição.
          </SheetDescription>
          <div className="relative pt-2">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              placeholder="Buscar EPI, código ou CA..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground p-4">Carregando estoque...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-sm text-muted-foreground p-6 text-center">
              Nenhum item encontrado.
            </div>
          )}
          {filtered.map((i) => {
            const baixo = i.quantidade_atual <= i.estoque_minimo;
            const caVencido = i.ca_validade && i.ca_validade < today;
            return (
              <div key={i.id} className="border rounded-lg p-2.5 hover:bg-slate-50 transition flex gap-3">
                {i.imagem_url ? (
                  <img src={i.imagem_url} alt="" className="h-14 w-14 rounded object-cover border flex-shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded border bg-slate-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 truncate">{i.nome_material}</span>
                    <Badge variant="outline" className="text-[10px]">Cód. {i.codigo_material}</Badge>
                    {baixo && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Estoque baixo
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>
                      CA: <strong>{i.ca || "—"}</strong>
                      {i.ca_validade && (
                        <span className={caVencido ? "text-rose-700 ml-1" : "text-slate-500 ml-1"}>
                          (val. {formatDateBR(i.ca_validade)}{caVencido ? " — vencido" : ""})
                        </span>
                      )}
                    </span>
                    <span>Qtd: <strong>{i.quantidade_atual}</strong> / mín. {i.estoque_minimo}</span>
                    {i.ultimo_fornecedor && <span>Forn.: {i.ultimo_fornecedor}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {onPick && (
                      <Button size="sm" variant="default" className="h-7 px-2 bg-red-700 hover:bg-red-800" onClick={() => usar(i)}>
                        <ArrowDownToLine className="h-3 w-3 mr-1" /> Usar na requisição
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copy(i.nome_material, "Nome")}>
                      <Copy className="h-3 w-3 mr-1" /> Nome
                    </Button>
                    {i.ca && (
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copy(i.ca!, "CA")}>
                        <Copy className="h-3 w-3 mr-1" /> CA
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copy(i.codigo_material, "Código")}>
                      <Copy className="h-3 w-3 mr-1" /> Código
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
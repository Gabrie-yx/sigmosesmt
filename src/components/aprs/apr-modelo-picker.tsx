import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, FileText, AlertTriangle, Zap } from "lucide-react";

export type AprModelo = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  descricao_curta: string | null;
  atividade_descricao: string;
  setor_padrao: string | null;
  local_padrao: string | null;
  condicoes_climaticas: string | null;
  observacoes_gerais: string | null;
  exige_pte: boolean;
  ptes_sugeridas: string[];
  riscos: any[];
};

const CATEGORIA_LABEL: Record<string, { label: string; cls: string }> = {
  CORTE_SOLDA: { label: "Corte/Solda", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  ICAMENTO: { label: "Içamento", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  JATEAMENTO: { label: "Jateamento", cls: "bg-purple-100 text-purple-800 border-purple-300" },
  ALTURA: { label: "Altura", cls: "bg-red-100 text-red-800 border-red-300" },
  CESTO_AEREO: { label: "Cesto Aéreo", cls: "bg-pink-100 text-pink-800 border-pink-300" },
};

export function AprModeloPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (modelo: AprModelo) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["apr-modelos-ativos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apr_modelos")
        .select("*")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as AprModelo[];
    },
  });

  const filtered = modelos.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      m.nome.toLowerCase().includes(s) ||
      (m.descricao_curta ?? "").toLowerCase().includes(s) ||
      (m.categoria ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Criar APR a partir de modelo
          </DialogTitle>
          <DialogDescription>
            Selecione um modelo pré-construído. Os riscos, EPIs, NRs e ações preventivas
            virão preenchidos — você ajusta apenas o que é específico da frente (peso,
            local exato, executantes, horário).
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar modelo (ex: solda, altura, içamento)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Carregando modelos...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              Nenhum modelo encontrado.
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filtered.map((m) => {
                const cat = CATEGORIA_LABEL[m.categoria] ?? { label: m.categoria, cls: "bg-slate-100" };
                const numRiscos = Array.isArray(m.riscos) ? m.riscos.length : 0;
                const numGrave = Array.isArray(m.riscos)
                  ? m.riscos.filter((r: any) => (r.probabilidade + r.severidade) >= 5).length
                  : 0;
                return (
                  <Card
                    key={m.id}
                    className="p-4 hover:border-primary hover:shadow-md transition cursor-pointer"
                    onClick={() => {
                      onSelect(m);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-semibold text-sm">{m.nome}</h3>
                          <Badge variant="outline" className={cat.cls}>
                            {cat.label}
                          </Badge>
                          {m.exige_pte && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300">
                              Exige PTE
                            </Badge>
                          )}
                        </div>
                        {m.descricao_curta && (
                          <p className="text-xs text-slate-600 mb-2">{m.descricao_curta}</p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" /> {numRiscos} riscos
                          </span>
                          {numGrave > 0 && (
                            <span className="flex items-center gap-1 text-red-600 font-medium">
                              <AlertTriangle className="h-3 w-3" /> {numGrave} grave(s)
                            </span>
                          )}
                          {m.ptes_sugeridas?.length > 0 && (
                            <span>PTE: {m.ptes_sugeridas.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="default">
                        Usar
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
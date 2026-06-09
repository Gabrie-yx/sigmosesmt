import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HardHat, Search, ArrowRight } from "lucide-react";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function QuickEpiDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["quick-epi-employees"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, matricula, funcao, status")
        .order("nome")
        .limit(800);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return employees.slice(0, 30);
    return employees
      .filter((e: any) =>
        `${e.nome ?? ""} ${e.matricula ?? ""} ${e.funcao ?? ""}`.toLowerCase().includes(t),
      )
      .slice(0, 40);
  }, [employees, q]);

  const go = (employeeId: string) => {
    onOpenChange(false);
    navigate({ to: "/app/employees/$id", params: { id: employeeId }, search: { tab: "epis" } as any });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b bg-gradient-to-r from-amber-50 to-amber-100/60">
          <SheetTitle className="flex items-center gap-2 text-base">
            <HardHat className="h-4 w-4 text-amber-700" />
            Baixa rápida de EPI
          </SheetTitle>
          <SheetDescription className="text-xs">
            Busque o funcionário e dê baixa sem perder o que está fazendo.
          </SheetDescription>
        </SheetHeader>

        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Nome, matrícula ou função…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && <p className="text-xs text-muted-foreground p-3">Carregando…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">Nenhum funcionário encontrado.</p>
          )}
          <ul className="space-y-1">
            {filtered.map((e: any) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => go(e.id)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{e.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {e.matricula ? `Mat. ${e.matricula} · ` : ""}{e.funcao ?? "—"}
                      {e.status ? ` · ${e.status}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t p-3 bg-muted/30">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate({ to: "/app/estoque/epi" });
            }}
          >
            Abrir Estoque de EPIs completo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
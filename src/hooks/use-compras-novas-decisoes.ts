import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LS_KEY = "compras:last-seen-decisoes";
const QK = ["compras", "novas-decisoes"] as const;

function readLastSeen(): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return window.localStorage.getItem(LS_KEY) ?? new Date(0).toISOString();
}

/**
 * Conta RCs decididas pelo Supervisor (APROVADA / INDEFERIDA) que ainda
 * não foram vistas pelo Compras. Usa localStorage como marca de "visto".
 */
export function useNovasDecisoesCompras() {
  const { user, roles, hasModule } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCompras = isAdmin || (roles as string[]).includes("compras") || hasModule("compras" as any);
  const qc = useQueryClient();
  const [lastSeen, setLastSeen] = useState<string>(() => readLastSeen());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setLastSeen(readLastSeen());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { data = 0 } = useQuery({
    queryKey: [...QK, lastSeen],
    enabled: !!user && isCompras,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .in("status", ["APROVADA", "INDEFERIDA"] as any)
        .is("arquivada_em", null)
        .gt("decidido_em", lastSeen);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, now);
    setLastSeen(now);
    qc.invalidateQueries({ queryKey: QK });
  }, [qc]);

  return { count: data, markAllSeen };
}
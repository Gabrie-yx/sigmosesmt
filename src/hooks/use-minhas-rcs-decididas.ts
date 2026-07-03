import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LS_KEY_PREFIX = "solicitante:last-seen-decisoes:";
const QK = ["solicitante", "minhas-rcs-decididas"] as const;

function readLastSeen(userId: string): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return window.localStorage.getItem(LS_KEY_PREFIX + userId) ?? new Date(0).toISOString();
}

/**
 * Conta RCs do próprio solicitante que receberam decisão do supervisor
 * (APROVADA / INDEFERIDA) ou que foram DEVOLVIDAS pelo Compras
 * desde a última vez que ele viu.
 */
export function useMinhasRcsDecididas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [lastSeen, setLastSeen] = useState<string>(() =>
    user ? readLastSeen(user.id) : new Date(0).toISOString(),
  );

  useEffect(() => {
    if (user) setLastSeen(readLastSeen(user.id));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const key = LS_KEY_PREFIX + user.id;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setLastSeen(readLastSeen(user.id));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user]);

  const { data = 0 } = useQuery({
    queryKey: [...QK, user?.id, lastSeen],
    enabled: !!user,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user) return 0;
      // Decisões do supervisor (APROVADA / INDEFERIDA) recentes
      const { count: decCount } = await supabase
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .in("status", ["APROVADA", "INDEFERIDA"] as any)
        .is("arquivada_em", null)
        .gt("decidido_em", lastSeen);
      // Devoluções do Compras recentes
      const { count: devCount } = await supabase
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "DEVOLVIDA" as any)
        .is("arquivada_em", null)
        .gt("devolvida_em", lastSeen);
      return (decCount ?? 0) + (devCount ?? 0);
    },
  });

  const markAllSeen = useCallback(() => {
    if (!user) return;
    const now = new Date().toISOString();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_KEY_PREFIX + user.id, now);
    }
    setLastSeen(now);
    qc.invalidateQueries({ queryKey: QK });
  }, [qc, user]);

  return { count: data, markAllSeen };
}
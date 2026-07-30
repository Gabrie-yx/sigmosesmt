import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useIsOnline } from "@/hooks/use-is-online";
import { listPendingSync, removeSyncItem, updateSyncItem } from "@/lib/offline-db";
import { syncExtintorInspecaoOffline } from "@/lib/extintor-offline.functions";

/** Máximo de tentativas antes de parar de reprocessar automaticamente. */
const MAX_ATTEMPTS = 5;
/** Item preso em "syncing" há mais que isso é considerado órfão (aba fechada no meio). */
const STALE_SYNCING_MS = 2 * 60 * 1000;
/** Reprocessa a fila periodicamente enquanto houver internet. */
const RETRY_INTERVAL_MS = 60 * 1000;

/**
 * Hook que observa a conexão e sincroniza a fila offline automaticamente.
 * Deve ser usado uma única vez, no __root.tsx.
 */
export function useOfflineSync() {
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncFn = useServerFn(syncExtintorInspecaoOffline);
  // Guarda a função em ref para que o efeito não dependa da identidade dela.
  const syncFnRef = useRef(syncFn);
  syncFnRef.current = syncFn;

  const runSync = useCallback(async () => {
    if (isSyncing.current) return;
    if (typeof window === "undefined" || !navigator.onLine) return;

    isSyncing.current = true;
    let ok = 0;
    let fail = 0;

    try {
      const pending = await listPendingSync();
      setPendingCount(pending.length);
      if (pending.length === 0) return;

      for (const item of pending) {
        // Itens presos em "syncing" (aba fechada no meio) voltam para a fila.
        if (item.status === "syncing") {
          const age = Date.now() - new Date(item.createdAt).getTime();
          if (age < STALE_SYNCING_MS) continue;
        }
        if (item.attempts >= MAX_ATTEMPTS) continue;

        try {
          await updateSyncItem(item.id, { status: "syncing", attempts: item.attempts + 1 });

          if (item.table === "extintor_inspecoes_fotos") {
            await syncFnRef.current({ data: item.payload as any });
          } else {
            throw new Error(`Tabela não suportada offline: ${item.table}`);
          }

          await removeSyncItem(item.id);
          ok++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[SIGMO Offline] Falha no sync ${item.id}:`, msg);
          await updateSyncItem(item.id, { status: "failed", lastError: msg });
          fail++;
          // Erro de rede: aborta o lote, tenta tudo de novo depois.
          if (/fetch|network|failed to fetch|load failed/i.test(msg)) break;
        }
      }

      const restantes = await listPendingSync();
      setPendingCount(restantes.length);

      if (ok > 0) {
        toast.success(
          ok === 1 ? "1 registro offline sincronizado." : `${ok} registros offline sincronizados.`,
        );
        queryClient.invalidateQueries({ queryKey: ["extintor-inspecoes-fotos-recentes"] });
        queryClient.invalidateQueries({ queryKey: ["extintor-inspecoes"] });
        queryClient.invalidateQueries({ queryKey: ["extintores"] });
      }
      if (fail > 0 && ok === 0) {
        toast.error("Não foi possível sincronizar os registros offline. Tentaremos de novo.");
      }
    } finally {
      isSyncing.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Conta inicial da fila, mesmo offline.
    listPendingSync()
      .then((p) => setPendingCount(p.length))
      .catch(() => {});

    if (!isOnline) return;

    void runSync();

    const interval = window.setInterval(() => void runSync(), RETRY_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isOnline, runSync]);

  return { pendingCount, isOnline, syncNow: runSync };
}

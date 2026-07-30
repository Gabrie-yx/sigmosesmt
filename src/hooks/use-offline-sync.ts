import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useIsOnline } from "@/hooks/use-is-online";
import { listPendingSync, removeSyncItem, updateSyncItem } from "@/lib/offline-db";
import { syncExtintorInspecaoOffline } from "@/lib/extintor-offline.functions";

/**
 * Hook que observa a conexão e sincroniza a fila offline automaticamente.
 * Deve ser usado uma única vez, no __root.tsx.
 */
export function useOfflineSync() {
  const isOnline = useIsOnline();
  const isSyncing = useRef(false);
  const syncFn = useServerFn(syncExtintorInspecaoOffline);

  useEffect(() => {
    if (!isOnline || isSyncing.current) return;

    async function run() {
      isSyncing.current = true;
      try {
        const pending = await listPendingSync();
        if (pending.length === 0) return;

        console.log(`[SIGMO Offline] ${pending.length} item(s) pendentes de sincronização`);

        for (const item of pending) {
          if (item.status !== "pending") continue;

          try {
            await updateSyncItem(item.id, { status: "syncing", attempts: item.attempts + 1 });

            if (item.table === "extintor_inspecoes_fotos") {
              await syncFn({ data: item.payload });
            } else {
              throw new Error(`Tabela não suportada offline: ${item.table}`);
            }

            await removeSyncItem(item.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[SIGMO Offline] Falha no sync ${item.id}:`, msg);
            await updateSyncItem(item.id, { status: "failed", lastError: msg });
          }
        }
      } finally {
        isSyncing.current = false;
      }
    }

    run();
  }, [isOnline, syncFn]);
}

import { useOfflineSync } from "@/hooks/use-offline-sync";

/**
 * Dispara a sincronização da fila offline.
 * Precisa ficar DENTRO do provider do React Query (usa useQueryClient).
 */
export function OfflineSync() {
  useOfflineSync();
  return null;
}

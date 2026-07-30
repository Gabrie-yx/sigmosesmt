import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { setOfflineStore, getOfflineStoreRows, getOfflineStore } from "@/lib/offline-db";
import { useIsOnline } from "@/hooks/use-is-online";

/**
 * Hook wrapper em useQuery que persiste resultados no IndexedDB.
 * - Online: busca na rede e atualiza o cache local.
 * - Offline (ou falha de rede): devolve o que está no cache local.
 */
export function useOfflineQuery<T extends Record<string, any>>(
  key: string,
  queryFn: () => Promise<T[]>,
  idField: keyof T,
  options?: Omit<UseQueryOptions<T[], Error>, "queryKey" | "queryFn" | "initialData">,
) {
  const isOnline = useIsOnline();

  return useQuery<T[], Error>({
    queryKey: [key],
    // networkMode "always" evita que o React Query pause a query quando
    // navigator.onLine === false — precisamos rodar para ler o IndexedDB.
    networkMode: "always",
    retry: (failureCount) => isOnline && failureCount < 2,
    queryFn: async () => {
      if (!isOnline) {
        return getOfflineStoreRows<T>(key);
      }

      try {
        const rows = await queryFn();
        try {
          await setOfflineStore(key, rows, idField);
        } catch {
          /* falha ao gravar cache não pode derrubar a tela */
        }
        return rows;
      } catch (err) {
        // navigator.onLine mente com frequência (wifi sem internet).
        // Se houver cache, usa o cache em vez de quebrar a tela.
        const cached = await getOfflineStoreRows<T>(key);
        if (cached.length > 0) return cached;
        throw err;
      }
    },
    ...options,
  });
}

/**
 * Recupera a data/hora da última sincronização de uma tabela offline.
 */
export async function getLastSyncAt(key: string): Promise<string | null> {
  const entry = await getOfflineStore(key);
  return entry?.updatedAt ?? null;
}

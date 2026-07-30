import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { setOfflineStore, getOfflineStoreRows, getOfflineStore } from "@/lib/offline-db";
import { useIsOnline } from "@/hooks/use-is-online";

/**
 * Hook wrapper em useQuery que persiste resultados no IndexedDB.
 * Quando o dispositivo está offline, retorna os dados do cache local.
 */
export function useOfflineQuery<T extends { id: string | number }>(
  key: string,
  queryFn: () => Promise<T[]>,
  idField: keyof T,
  options?: Omit<UseQueryOptions<T[], Error>, "queryKey" | "queryFn" | "initialData">,
) {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      if (isOnline) {
        const rows = await queryFn();
        await setOfflineStore(key, rows, idField);
        return rows;
      }
      return getOfflineStoreRows<T>(key);
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


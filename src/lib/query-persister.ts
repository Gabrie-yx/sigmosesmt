import { openDB } from "idb";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

const DB_NAME = "sigmo-query-cache";
const DB_VERSION = 1;
const STORE_NAME = "queries";

/**
 * Persister do TanStack Query sobre IndexedDB.
 * Mantém o cache de queries disponível offline.
 */
export function createIdbPersister(): Persister {
  const db = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

  return {
    persistClient: async (client: PersistedClient) => {
      const d = await db;
      await d.put(STORE_NAME, client, "client");
    },
    restoreClient: async () => {
      const d = await db;
      return (await d.get(STORE_NAME, "client")) ?? null;
    },
    removeClient: async () => {
      const d = await db;
      await d.delete(STORE_NAME, "client");
    },
  };
}

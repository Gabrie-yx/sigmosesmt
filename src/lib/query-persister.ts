import { openDB, type IDBPDatabase } from "idb";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const DB_NAME = "sigmo-query-cache";
const DB_VERSION = 1;
const STORE_NAME = "queries";

let dbPromise: Promise<IDBPDatabase> | null = null;
let persisterSingleton: Persister | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/** Persister no-op usado no SSR (não há IndexedDB no servidor). */
const noopPersister: Persister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

/**
 * Persister do TanStack Query sobre IndexedDB.
 * Singleton: nunca recria a conexão a cada render.
 */
export function createIdbPersister(): Persister {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return noopPersister;
  }

  if (!persisterSingleton) {
    persisterSingleton = {
      persistClient: async (client: PersistedClient) => {
        try {
          const d = await getDB();
          await d.put(STORE_NAME, client, "client");
        } catch {
          /* cota cheia ou modo privado: ignora */
        }
      },
      restoreClient: async () => {
        try {
          const d = await getDB();
          return (await d.get(STORE_NAME, "client")) ?? undefined;
        } catch {
          return undefined;
        }
      },
      removeClient: async () => {
        try {
          const d = await getDB();
          await d.delete(STORE_NAME, "client");
        } catch {
          /* ignora */
        }
      },
    };
  }

  return persisterSingleton;
}

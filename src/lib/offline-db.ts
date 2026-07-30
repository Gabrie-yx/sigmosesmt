import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const OFFLINE_DB_NAME = "sigmo-offline";
export const OFFLINE_DB_VERSION = 1;

/**
 * Registro de cache de uma tabela/query.
 * Armazena a lista completa de IDs para permitir paginação/ordenação local.
 */
export interface OfflineStoreEntry<T = unknown> {
  key: string; // namespace da tabela/query, ex: "extintores:lista"
  rows: Record<string, T>; // mapa id -> row
  ids: string[]; // ordem dos resultados
  updatedAt: string; // ISO timestamp
  meta?: Record<string, unknown>;
}

/**
 * Item da fila de sincronização.
 */
export interface SyncQueueItem<T = unknown> {
  id: string; // id local único (uuid)
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "UPLOAD_FILE";
  payload: T;
  originalId?: string; // id real no banco, quando UPDATE/DELETE
  fileId?: string; // referência para upload de arquivo
  createdAt: string; // ISO
  attempts: number;
  lastError?: string;
  status: "pending" | "syncing" | "failed";
}

/**
 * Arquivo armazenado localmente aguardando sync.
 */
export interface OfflineFile {
  id: string;
  bucket?: string;
  path?: string;
  file: Blob;
  name: string;
  type: string;
  createdAt: string;
  syncedAt?: string;
}

interface SIGMOOfflineDB extends DBSchema {
  store: {
    key: string;
    value: OfflineStoreEntry;
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
  };
  files: {
    key: string;
    value: OfflineFile;
  };
}

let dbPromise: Promise<IDBPDatabase<SIGMOOfflineDB>> | null = null;

export function getOfflineDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB offline só está disponível no navegador");
  }

  if (!dbPromise) {
    dbPromise = openDB<SIGMOOfflineDB>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("store")) {
          db.createObjectStore("store", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "id" });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Guarda um conjunto de linhas no cache offline.
 */
export async function setOfflineStore<T>(
  key: string,
  rows: T[],
  idField: keyof T,
  meta?: Record<string, unknown>,
) {
  const db = await getOfflineDB();
  const map: Record<string, T> = {};
  const ids: string[] = [];

  for (const row of rows) {
    const id = String(row[idField]);
    map[id] = row;
    ids.push(id);
  }

  await db.put("store", {
    key,
    rows: map,
    ids,
    updatedAt: new Date().toISOString(),
    meta,
  });
}

/**
 * Recupera o cache de uma tabela/query.
 */
export async function getOfflineStore<T>(key: string): Promise<OfflineStoreEntry<T> | null> {
  const db = await getOfflineDB();
  return (await db.get("store", key)) as OfflineStoreEntry<T> | null;
}

/**
 * Recupera todas as linhas de uma tabela/query em ordem.
 */
export async function getOfflineStoreRows<T>(key: string): Promise<T[]> {
  const entry = await getOfflineStore<T>(key);
  if (!entry) return [];
  return entry.ids.map((id) => entry.rows[id]);
}

/**
 * Limpa uma tabela/query do cache.
 */
export async function clearOfflineStore(key: string) {
  const db = await getOfflineDB();
  await db.delete("store", key);
}

/**
 * Adiciona item à fila de sincronização.
 */
export async function enqueueSync<T>(item: Omit<SyncQueueItem<T>, "id" | "createdAt" | "attempts" | "status">) {
  const db = await getOfflineDB();
  const full: SyncQueueItem<T> = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  await db.put("sync_queue", full);
  return full;
}

/**
 * Lista itens pendentes da fila.
 */
export async function listPendingSync(): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  return db.getAll("sync_queue");
}

/**
 * Atualiza status de um item da fila.
 */
export async function updateSyncItem(id: string, patch: Partial<SyncQueueItem>) {
  const db = await getOfflineDB();
  const item = await db.get("sync_queue", id);
  if (!item) return;
  await db.put("sync_queue", { ...item, ...patch });
}

/**
 * Remove item da fila (quando sync concluído com sucesso).
 */
export async function removeSyncItem(id: string) {
  const db = await getOfflineDB();
  await db.delete("sync_queue", id);
}

/**
 * Salva arquivo offline para upload posterior.
 */
export async function saveOfflineFile(file: Blob, name: string, type: string, bucket?: string, path?: string) {
  const db = await getOfflineDB();
  const id = crypto.randomUUID();
  const entry: OfflineFile = {
    id,
    bucket,
    path,
    file,
    name,
    type,
    createdAt: new Date().toISOString(),
  };
  await db.put("files", entry);
  return id;
}

/**
 * Recupera arquivo offline.
 */
export async function getOfflineFile(id: string): Promise<OfflineFile | null> {
  const db = await getOfflineDB();
  return (await db.get("files", id)) ?? null;
}

/**
 * Marca arquivo como sincronizado.
 */
export async function markOfflineFileSynced(id: string) {
  const db = await getOfflineDB();
  const item = await db.get("files", id);
  if (!item) return;
  item.syncedAt = new Date().toISOString();
  await db.put("files", item);
}

/**
 * Remove arquivo offline.
 */
export async function removeOfflineFile(id: string) {
  const db = await getOfflineDB();
  await db.delete("files", id);
}

// Sistema simples de rascunhos com autosave em localStorage.
// Cada rascunho é identificado por uma `key` única (ex: "requisicao-nova"),
// guarda os dados brutos do formulário + label amigável + rota para retomar.

const KEY_PREFIX = "sigmo:draft:";
const EVT = "sigmo:drafts-changed";

export type DraftRecord<T = unknown> = {
  label: string;
  route: string;
  data: T;
  updatedAt: number;
};

export type DraftMeta = {
  key: string;
  label: string;
  route: string;
  updatedAt: number;
};

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

export function saveDraft<T>(key: string, label: string, route: string, data: T) {
  const w = safeWindow();
  if (!w) return;
  try {
    const payload: DraftRecord<T> = { label, route, data, updatedAt: Date.now() };
    w.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(payload));
    w.dispatchEvent(new CustomEvent(EVT));
  } catch {
    // localStorage cheio / privado — ignora silenciosamente
  }
}

export function loadDraft<T = unknown>(key: string): DraftRecord<T> | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as DraftRecord<T>;
  } catch {
    return null;
  }
}

export function deleteDraft(key: string) {
  const w = safeWindow();
  if (!w) return;
  w.localStorage.removeItem(KEY_PREFIX + key);
  w.dispatchEvent(new CustomEvent(EVT));
}

export function listDrafts(): DraftMeta[] {
  const w = safeWindow();
  if (!w) return [];
  const out: DraftMeta[] = [];
  for (let i = 0; i < w.localStorage.length; i++) {
    const k = w.localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    try {
      const rec = JSON.parse(w.localStorage.getItem(k)!) as DraftRecord;
      out.push({
        key: k.slice(KEY_PREFIX.length),
        label: rec.label,
        route: rec.route,
        updatedAt: rec.updatedAt,
      });
    } catch {
      // ignora corrompidos
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const DRAFTS_EVENT = EVT;
import { useEffect, useRef } from "react";
import { saveDraft } from "@/lib/draft-store";

/**
 * Autosave de rascunho: serializa `data` no localStorage com debounce.
 * Use `enabled=false` para pausar (ex.: ao editar registro existente).
 */
export function useDraftAutosave<T>(
  key: string,
  label: string,
  route: string,
  data: T,
  opts?: { enabled?: boolean; delayMs?: number },
) {
  const enabled = opts?.enabled ?? true;
  const delay = opts?.delayMs ?? 1500;
  const firstRun = useRef(true);
  const serialized = JSON.stringify(data);

  useEffect(() => {
    if (!enabled) return;
    // não salva no mount inicial pra evitar gravar valores default vazios
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      saveDraft(key, label, route, data);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, key, label, route, delay]);
}
import { useEffect, useRef } from "react";
import { saveDraft, DRAFTS_EVENT, clearDraftTombstone } from "@/lib/draft-store";

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
  const suppressUntilChange = useRef(false);
  const lastSerialized = useRef<string | null>(null);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialized = JSON.stringify(data);

  const clearPendingSave = () => {
    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) {
      clearPendingSave();
      return;
    }
    // Nova montagem/ativação do form → limpa tombstone da chave.
    // Assim, se o usuário descartou o rascunho pela barra e voltou
    // depois pra tela, o autosave volta a funcionar normalmente.
    clearDraftTombstone(key);
    // não salva no mount inicial pra evitar gravar valores default vazios
    if (firstRun.current) {
      firstRun.current = false;
      lastSerialized.current = serialized;
      return;
    }
    // Se o rascunho foi apagado externamente (pelo usuário na barra de
    // rascunhos), suprime o autosave até que os dados mudem de fato.
    // Sem isso, o autosave reescreve o rascunho logo após a exclusão.
    if (suppressUntilChange.current) {
      if (serialized === lastSerialized.current) return;
      suppressUntilChange.current = false;
    }
    clearPendingSave();
    const t = setTimeout(() => {
      saveDraft(key, label, route, data);
      lastSerialized.current = serialized;
      if (pendingSave.current === t) pendingSave.current = null;
    }, delay);
    pendingSave.current = t;
    return () => {
      clearTimeout(t);
      if (pendingSave.current === t) pendingSave.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, key, label, route, delay]);

  // Detecta exclusão externa do rascunho e ativa a supressão.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const onChange = () => {
      try {
        const exists = window.localStorage.getItem("sigmo:draft:" + key) !== null;
        if (!exists) {
          clearPendingSave();
          suppressUntilChange.current = true;
          lastSerialized.current = serialized;
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener(DRAFTS_EVENT, onChange);
    return () => window.removeEventListener(DRAFTS_EVENT, onChange);
  }, [enabled, key]);
}
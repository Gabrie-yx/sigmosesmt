import { useSyncExternalStore } from "react";

function getOnlineStatus() {
  return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
    ? navigator.onLine
    : true;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Hook que retorna true se o dispositivo estiver online.
 * Atualiza automaticamente quando a conexão muda.
 */
export function useIsOnline() {
  return useSyncExternalStore(subscribe, getOnlineStatus, () => true);
}

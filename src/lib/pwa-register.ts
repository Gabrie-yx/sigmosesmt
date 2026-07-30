import { registerSW } from "virtual:pwa-register";

/**
 * Registra o service worker do SIGMO apenas em produção/publicado.
 * Nunca em dev, preview Lovable, iframe ou quando ?sw=off está presente.
 */
export function registerSIGMOPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const hostname = window.location.hostname;
  const isPreview =
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev");

  const isIframe = window.self !== window.top;
  const swOff = new URLSearchParams(window.location.search).has("sw");
  const isDev = import.meta.env.DEV;

  if (isDev || isPreview || isIframe || swOff) {
    // Em ambientes de preview/dev, garante que nenhum SW de app shell fique preso.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) =>
        Promise.allSettled(
          regs
            .filter((r) => r.scope.includes(window.location.origin) && r.active?.scriptURL?.includes("/sw.js"))
            .map((r) => r.unregister()),
        ),
      )
      .catch(() => {});
    return;
  }

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      console.log("[SIGMO PWA] Service Worker registrado:", swUrl, r?.scope);
    },
    onRegisterError(error) {
      console.error("[SIGMO PWA] Erro ao registrar SW:", error);
    },
    onNeedRefresh() {
      // Atualização disponível — recarrega para aplicar a nova versão.
      window.location.reload();
    },
    onOfflineReady() {
      console.log("[SIGMO PWA] App pronto para uso offline");
    },
  });

  return updateSW;
}

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouterState } from "@tanstack/react-router";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sigmo:pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const legacy = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // iPadOS 13+ se apresenta como Mac com touch — detectar via maxTouchPoints
  const ipadOS =
    /Mac/.test(ua) &&
    typeof navigator !== "undefined" &&
    (navigator as any).maxTouchPoints > 1;
  return legacy || ipadOS;
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Não mostrar em rotas públicas/anônimas
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/denuncia");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    // Se o evento já foi capturado pelo script inline antes do React montar,
    // recupera aqui em vez de perder para sempre.
    const early = (window as any).__sigmoBIP as BIPEvent | null | undefined;
    if (early) {
      setDeferred(early);
      setVisible(true);
    }
    const onBIPReady = () => {
      const ev = (window as any).__sigmoBIP as BIPEvent | null | undefined;
      if (ev) {
        setDeferred(ev);
        setVisible(true);
      }
    };
    window.addEventListener("sigmo:bip-ready", onBIPReady);
    window.addEventListener("beforeinstallprompt", onBIP as EventListener);
    window.addEventListener("appinstalled", onInstalled);

    // iOS não dispara beforeinstallprompt: mostra dica manual após pequeno delay
    if (isIOS()) {
      const t = setTimeout(() => {
        if (!isStandalone() && !wasRecentlyDismissed()) {
          setShowIOSHint(true);
          setVisible(true);
        }
      }, 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("sigmo:bip-ready", onBIPReady);
        window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("sigmo:bip-ready", onBIPReady);
      window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome !== "accepted") dismiss();
    setDeferred(null);
    setVisible(false);
  }

  if (!visible) return null;
  if (isPublicRoute) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-xl">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-red-600 to-orange-500 shadow-lg">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wide">Instalar SIGMO</p>
          {showIOSHint ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Toque em <Share className="inline h-3.5 w-3.5 align-[-2px]" /> e depois em{" "}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Instale como app para abrir direto do ícone, em tela cheia e mais rápido.
            </p>
          )}
          {!showIOSHint && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={install}
                className="h-8 bg-red-600 text-white hover:bg-red-500"
              >
                Instalar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="h-8 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Agora não
              </Button>
            </div>
          )}
          {showIOSHint && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="h-8 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Entendi
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
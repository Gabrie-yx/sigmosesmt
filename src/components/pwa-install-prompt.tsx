import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
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
        window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
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
        </div>
      </div>
    </div>
  );
}
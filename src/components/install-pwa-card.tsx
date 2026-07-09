// Banner de instalação do SIGMO na tela inicial do celular.
// - Android/Chrome: usa `beforeinstallprompt` (nativo).
// - iOS Safari: mostra passo-a-passo (Compartilhar → Adicionar à Tela de Início).
// - Some sozinho se o app já estiver rodando instalado (display-mode: standalone).
import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sigmo:pwa-install-dismissed";

export function InstallPwaCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Já rodando instalado? Não mostra nada.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }

    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(iOS);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIOS) setShowIOSHelp(true);
  };

  if (installed || dismissed) return null;
  // Nada pra oferecer? (desktop sem prompt, browser sem suporte)
  if (!deferred && !isIOS) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-400/95 to-amber-500/95 text-amber-950 p-4 shadow-lg ring-1 ring-amber-600/40 relative overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 h-7 w-7 rounded-full hover:bg-black/10 grid place-items-center"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/40 grid place-items-center ring-1 ring-black/10">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm leading-tight">Instalar SIGMO no celular</p>
          <p className="text-xs font-semibold mt-0.5 opacity-90">
            Deixa o ícone na tela inicial pra abrir já logado, sem digitar endereço.
          </p>
          {!showIOSHelp && (
            <button
              type="button"
              onClick={install}
              className="mt-3 h-10 px-4 rounded-xl bg-amber-950 text-amber-50 font-black text-sm inline-flex items-center gap-2 active:scale-95 transition"
            >
              <Download className="h-4 w-4" /> Instalar agora
            </button>
          )}
          {showIOSHelp && (
            <ol className="mt-3 space-y-1.5 text-xs font-semibold">
              <li className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-amber-950 text-amber-50 grid place-items-center text-[10px] font-black">1</span>
                Toque em <Share className="inline h-3.5 w-3.5" /> (Compartilhar) na barra do Safari
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-amber-950 text-amber-50 grid place-items-center text-[10px] font-black">2</span>
                Escolha <Plus className="inline h-3.5 w-3.5" /> "Adicionar à Tela de Início"
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-amber-950 text-amber-50 grid place-items-center text-[10px] font-black">3</span>
                Confirme em "Adicionar" — pronto, o ícone tá lá.
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
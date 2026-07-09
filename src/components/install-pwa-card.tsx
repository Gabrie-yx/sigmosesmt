import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, MoreVertical, Plus, Share, Smartphone } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sigmo:pwa-install-dismissed";

export function InstallPwaCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [installUrl, setInstallUrl] = useState("https://sigmosesmt.lovable.app/app");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Já rodando instalado? Não mostra nada.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }

    localStorage.removeItem(DISMISS_KEY);
    setInstallUrl(new URL("/app", window.location.origin).toString());

    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const android = /Android/i.test(ua);
    const embedded = /WhatsApp|FBAN|FBAV|Instagram|Line|wv\)|; wv|Version\/\d+\.\d+ Chrome\/\d+.*Mobile Safari/i.test(ua);
    setIsIOS(iOS);
    setIsAndroid(android);
    setIsInAppBrowser(embedded);

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

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (installed) return null;

  return (
    <div className="rounded-2xl bg-card text-card-foreground p-4 shadow-lg ring-1 ring-border border border-border relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/15 text-primary grid place-items-center ring-1 ring-border">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm leading-tight">Colocar ícone do SIGMO na tela inicial</p>
          <p className="text-xs font-semibold mt-0.5 text-muted-foreground">
            O link aberto pelo WhatsApp não instala o app. Abra no navegador do celular e adicione o SIGMO à tela inicial.
          </p>

          {isInAppBrowser && (
            <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/25 p-3 text-xs font-bold text-foreground">
              <p>Você está dentro do WhatsApp. Toque no menu do WhatsApp e escolha abrir no Chrome/Safari.</p>
              <button
                type="button"
                onClick={() => window.open(installUrl, "_blank", "noopener,noreferrer")}
                className="mt-2 h-9 px-3 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-2 font-black active:scale-95 transition"
              >
                <ExternalLink className="h-4 w-4" /> Abrir navegador
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={install}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm inline-flex items-center gap-2 active:scale-95 transition"
            >
              <Download className="h-4 w-4" /> {deferred ? "Instalar agora" : "Ver passos"}
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="h-10 px-3 rounded-xl bg-secondary text-secondary-foreground font-black text-sm inline-flex items-center gap-2 active:scale-95 transition"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>

          {showHelp && (
            <ol className="mt-3 space-y-1.5 text-xs font-semibold text-foreground">
              <li className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-black">1</span>
                {isInAppBrowser ? "Abra este link no Chrome/Safari do celular" : "Use o navegador do celular, não o WhatsApp"}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-black">2</span>
                {isIOS ? (
                  <>Toque em <Share className="inline h-3.5 w-3.5" /> e depois em <Plus className="inline h-3.5 w-3.5" /> Adicionar à Tela de Início</>
                ) : isAndroid ? (
                  <>No Chrome, toque em <MoreVertical className="inline h-3.5 w-3.5" /> e escolha Instalar app ou Adicionar à tela inicial</>
                ) : (
                  <>No menu do navegador, escolha Instalar app ou Adicionar à tela inicial</>
                )}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-black">3</span>
                Confirme em "Adicionar" — pronto, o ícone tá lá.
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
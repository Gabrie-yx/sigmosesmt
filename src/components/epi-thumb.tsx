import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";

/**
 * Miniatura da foto do EPI com fallback gracioso.
 * Se a URL estiver quebrada (arquivo removido do storage), mostra o ícone
 * em vez do "quadradinho quebrado" do navegador.
 */
export function EpiThumb({
  url,
  alt = "",
  className = "h-10 w-10",
}: {
  url?: string | null;
  alt?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (!url || broken) {
    return (
      <div
        className={`${className} rounded border border-dashed border-muted-foreground/30 bg-muted/30 flex items-center justify-center text-muted-foreground/50 flex-shrink-0`}
        aria-hidden
      >
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={`${className} rounded object-cover border border-border flex-shrink-0`}
    />
  );
}

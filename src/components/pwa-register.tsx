import { useEffect } from "react";
import { registerSIGMOPWA } from "@/lib/pwa-register";

/**
 * Componente cliente que registra o service worker de forma segura.
 * Deve ser renderizado uma única vez, preferencialmente no root layout.
 */
export function PWARegister() {
  useEffect(() => {
    registerSIGMOPWA();
  }, []);

  return null;
}

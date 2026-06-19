import { useEffect, useCallback } from "react";

export type ThemeMode = "dmn";
const STORAGE_KEY = "sigmo:theme";

function apply() {
  const root = document.documentElement;
  root.classList.remove("theme-liquid", "theme-crystal");
  root.classList.add("theme-dmn");
}

export function useTheme() {
  useEffect(() => {
    apply();
    try { localStorage.setItem(STORAGE_KEY, "dmn"); } catch {}
  }, []);

  const setTheme = useCallback((_t: ThemeMode) => {}, []);
  const toggle = useCallback(() => {}, []);

  return { theme: "dmn" as ThemeMode, setTheme, toggle };
}

import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "dmn" | "liquid" | "crystal";
const STORAGE_KEY = "sigmo:theme";

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("theme-dmn", "theme-liquid", "theme-crystal");
  root.classList.add(`theme-${mode}`);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dmn";
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "dmn";
  });

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggle = useCallback(
    () =>
      setThemeState((t) =>
        t === "dmn" ? "liquid" : t === "liquid" ? "crystal" : "dmn",
      ),
    [],
  );

  return { theme, setTheme, toggle };
}

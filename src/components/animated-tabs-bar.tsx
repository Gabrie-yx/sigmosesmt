import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnimatedTab = {
  value: string;
  label: string;
  icon: LucideIcon;
};

interface Props {
  tabs: AnimatedTab[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function AnimatedTabsBar({ tabs, value, onChange, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({ left: bRect.left - cRect.left, width: bRect.width });
    setReady(true);
  }, [value, tabs.length]);

  useEffect(() => {
    const onResize = () => {
      const btn = btnRefs.current[value];
      const container = containerRef.current;
      if (!btn || !container) return;
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicator({ left: bRect.left - cRect.left, width: bRect.width });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex w-full items-stretch gap-1 rounded-xl border border-red-200/60 bg-gradient-to-r from-red-50 via-white to-red-50 p-1.5 shadow-sm overflow-x-auto",
        className,
      )}
    >
      {/* Pílula deslizante */}
      <div
        className={cn(
          "absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-md shadow-red-500/30 transition-all duration-300 ease-out",
          ready ? "opacity-100" : "opacity-0",
        )}
        style={{
          left: indicator.left,
          width: indicator.width,
          willChange: "left, width",
        }}
        aria-hidden
      />
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              btnRefs.current[t.value] = el;
            }}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "relative z-10 flex flex-1 min-w-fit items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors duration-200",
              active ? "text-white" : "text-slate-600 hover:text-red-700",
            )}
          >
            <Icon className={cn("h-4 w-4 transition-transform duration-200", active && "scale-110")} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

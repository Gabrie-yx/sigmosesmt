import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
};

export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = false,
  showEmpty = true,
  className,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: Size;
  readOnly?: boolean;
  showEmpty?: boolean;
  className?: string;
}) {
  const sz = SIZES[size];
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= value;
        if (!filled && !showEmpty && value > 0 && i > value) return null;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(i === value ? 0 : i)}
            className={cn(
              "transition-transform",
              !readOnly && "hover:scale-125 cursor-pointer",
              readOnly && "cursor-default",
            )}
            aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                sz,
                filled
                  ? "fill-amber-400 text-amber-500 drop-shadow-[0_0_2px_rgba(251,191,36,0.6)]"
                  : "text-slate-300",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
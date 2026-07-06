import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
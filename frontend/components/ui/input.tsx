import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-panelAlt px-3 text-sm text-text outline-none transition",
        "placeholder:text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        className
      )}
      {...props}
    />
  );
}

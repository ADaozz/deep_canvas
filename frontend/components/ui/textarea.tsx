import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-xl border border-border bg-panelAlt px-3 py-2 text-sm text-text outline-none transition",
        "placeholder:text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        className
      )}
      {...props}
    />
  );
}

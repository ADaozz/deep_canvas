import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  children
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-panelAlt px-2.5 py-1 text-[11px] font-medium text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

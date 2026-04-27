import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
};

export function Switch({ checked, onCheckedChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className="inline-flex items-center gap-3 text-sm text-text"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 rounded-full border transition",
          checked ? "border-blue-400/50 bg-blue-500/30" : "border-border bg-white/5"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

import * as React from "react";

import { cn } from "@/lib/utils";

type Option = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
};

export function SegmentedControl({
  value,
  onValueChange,
  options
}: SegmentedControlProps) {
  return (
    <div className="flex rounded-xl border border-border bg-panelAlt p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm transition",
            value === option.value
              ? "bg-accentSoft text-white shadow-glow"
              : "text-muted hover:text-text"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

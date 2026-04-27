import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl border text-sm font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "border-accent bg-accent px-4 text-white hover:bg-blue-500",
        variant === "secondary" &&
          "border-border bg-panelAlt px-4 text-text hover:border-blue-500/50 hover:bg-accentSoft",
        variant === "ghost" &&
          "border-transparent bg-transparent px-3 text-muted hover:bg-white/5 hover:text-text",
        variant === "danger" &&
          "border-red-500/30 bg-red-500/10 px-4 text-red-200 hover:bg-red-500/20",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-9 w-9 rounded-lg px-0",
        className
      )}
      {...props}
    />
  );
}

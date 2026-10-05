import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={twMerge(
          clsx(
            "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium transition-colors select-none cursor-pointer border",
            active
              ? "bg-accent-soft text-accent border-accent/40"
              : "bg-bg-field text-text-secondary border-border hover:bg-bg-hover hover:text-text-primary",
            className
          )
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Chip.displayName = "Chip";

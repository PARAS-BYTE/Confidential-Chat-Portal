import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "unread" | "warn" | "danger" | "neutral";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", children, ...props }, ref) => {
    const variantStyles = {
      unread: "bg-accent text-[#0b0c0c] font-semibold",
      warn: "bg-warn/20 text-warn border border-warn/30",
      danger: "bg-danger/20 text-danger border border-danger/30",
      neutral: "bg-bg-field text-text-secondary border border-border",
    };

    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium leading-none select-none",
            variantStyles[variant],
            className
          )
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

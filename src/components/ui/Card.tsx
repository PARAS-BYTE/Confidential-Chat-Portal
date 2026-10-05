import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            "rounded-lg bg-bg-surface border border-border p-4 text-text-primary",
            className
          )
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

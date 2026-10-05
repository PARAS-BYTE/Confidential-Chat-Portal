import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, disabled, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        disabled={disabled}
        className={twMerge(
          clsx(
            "flex h-9 w-full rounded bg-bg-field px-3 py-1 text-sm text-text-primary placeholder:text-text-secondary border border-border transition-colors",
            "focus-visible:outline-none focus-visible:border-text-secondary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger focus-visible:border-danger",
            className
          )
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

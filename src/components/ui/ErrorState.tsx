import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  className,
  title = "Something went wrong",
  message = "An error occurred while loading this section. Please try again.",
  onRetry,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto",
          className
        )
      )}
      {...props}
    >
      <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center mb-4 text-danger">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h3 className="text-base font-medium text-text-primary mb-1">
        {title}
      </h3>

      <p className="text-xs text-text-secondary leading-relaxed mb-4">
        {message}
      </p>

      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
}

import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ShieldCheck, Lock } from "lucide-react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  showSecurityNotice?: boolean;
}

export function EmptyState({
  className,
  title = "CCP Confidential Portal",
  description = "Select a conversation from the panel to start secure messaging. All communications are strictly isolated, confidential, and monitored according to compliance policies.",
  icon,
  showSecurityNotice = true,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto select-none",
          className
        )
      )}
      {...props}
    >
      <div className="w-16 h-16 rounded-full bg-bg-surface border border-border flex items-center justify-center mb-6 text-text-secondary">
        {icon || <ShieldCheck className="w-8 h-8 text-text-secondary" />}
      </div>

      <h2 className="text-xl font-medium text-text-primary mb-2 tracking-tight">
        {title}
      </h2>

      <p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-md">
        {description}
      </p>

      {showSecurityNotice && (
        <div className="flex items-center gap-2 text-xs text-text-secondary/70 pt-6 border-t border-border w-full justify-center">
          <Lock className="w-3.5 h-3.5" />
          <span>Server-side authorized and confidential</span>
        </div>
      )}
    </div>
  );
}

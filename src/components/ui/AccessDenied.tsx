import * as React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "./Button";

export interface AccessDeniedProps {
  title?: string;
  message?: string;
  returnUrl?: string;
  returnLabel?: string;
  className?: string;
}

export function AccessDenied({
  title = "Access Restricted",
  message = "You do not have clearance to view this resource or perform this administrative action.",
  returnUrl = "/projects",
  returnLabel = "Return to Conversations",
  className = "",
}: AccessDeniedProps) {
  return (
    <div
      className={`min-h-[340px] flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <h2 className="text-base font-medium text-text-primary mb-1.5">{title}</h2>
      <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed">
        {message}
      </p>

      {returnUrl && (
        <a href={returnUrl}>
          <Button variant="secondary" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
            <span>{returnLabel}</span>
          </Button>
        </a>
      )}
    </div>
  );
}

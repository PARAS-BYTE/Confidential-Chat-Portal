import * as React from "react";
import {
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export type StatusType =
  | "SENDING"
  | "DELIVERED"
  | "HELD"
  | "REJECTED"
  | "FAILED"
  | "APPROVED"
  | "DISMISSED"
  | "OPEN";

export interface StatusPillProps {
  status: StatusType | string;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export function StatusPill({
  status,
  size = "sm",
  showIcon = true,
  className = "",
}: StatusPillProps) {
  const normStatus = status.toUpperCase();

  let styles = "bg-bg-field text-text-secondary border-border";
  let label = status;
  let IconComponent: React.ElementType = Clock;

  switch (normStatus) {
    case "SENDING":
      styles = "bg-bg-field text-text-secondary border-border/60";
      label = "Sending";
      IconComponent = Clock;
      break;
    case "DELIVERED":
      styles = "bg-accent-soft text-accent border-accent/30";
      label = "Delivered";
      IconComponent = CheckCheck;
      break;
    case "HELD":
      styles = "bg-warn/10 text-warn border-warn/30";
      label = "Held for review";
      IconComponent = Clock;
      break;
    case "REJECTED":
      styles = "bg-danger/10 text-danger border-danger/30";
      label = "Rejected";
      IconComponent = XCircle;
      break;
    case "FAILED":
      styles = "bg-danger/10 text-danger border-danger/30";
      label = "Failed";
      IconComponent = AlertCircle;
      break;
    case "APPROVED":
      styles = "bg-accent-soft text-accent border-accent/30";
      label = "Approved";
      IconComponent = CheckCircle2;
      break;
    case "DISMISSED":
      styles = "bg-bg-field text-text-secondary border-border";
      label = "Dismissed";
      IconComponent = Check;
      break;
    case "OPEN":
      styles = "bg-warn/10 text-warn border-warn/30";
      label = "Open review";
      IconComponent = AlertTriangle;
      break;
  }

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-[11px] px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border select-none ${sizeClasses} ${styles} ${className}`}
    >
      {showIcon && <IconComponent className={`${iconSizes} shrink-0`} />}
      <span>{label}</span>
    </span>
  );
}

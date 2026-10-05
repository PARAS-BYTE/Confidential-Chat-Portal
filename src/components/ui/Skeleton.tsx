import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={twMerge(
        clsx("animate-pulse rounded bg-bg-hover", className)
      )}
      {...props}
    />
  );
}

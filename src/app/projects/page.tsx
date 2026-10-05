"use client";

import { Shell } from "@/components/layout/Shell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProjectsPage() {
  return (
    <Shell>
      <EmptyState
        title="Your Confidential Projects"
        description="Select a project from the left panel to review ongoing discussions. All messages are encrypted and monitored for compliance."
      />
    </Shell>
  );
}

"use client";

import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-app p-4 select-none">
      <Card className="w-full max-w-md bg-bg-surface border-border p-8 text-center shadow-md">
        <div className="w-14 h-14 rounded-full bg-danger/10 border border-danger/20 text-danger flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-lg font-medium text-text-primary tracking-tight mb-2">
          Access Restricted
        </h1>

        <p className="text-xs text-text-secondary leading-relaxed mb-6">
          You do not have administrative permissions to view this section.
          Confidential role boundaries are enforced strictly on the server.
        </p>

        <a href="/projects">
          <Button variant="secondary" className="w-full gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Projects</span>
          </Button>
        </a>
      </Card>
    </div>
  );
}

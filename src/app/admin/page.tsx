"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AdminPage() {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-bg-app p-8 flex flex-col items-center justify-center">
      <Card className="max-w-md w-full p-6 text-center space-y-4">
        <h1 className="text-xl font-medium text-text-primary">Admin Control Center</h1>
        <p className="text-xs text-text-secondary">
          Welcome to the administrative console. Administrative features will be loaded here.
        </p>
        <Button variant="secondary" onClick={handleLogout} className="w-full">
          Sign out
        </Button>
      </Card>
    </div>
  );
}

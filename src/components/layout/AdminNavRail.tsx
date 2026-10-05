"use client";

import * as React from "react";
import {
  Shield,
  FolderKanban,
  Users,
  Flag,
  Sliders,
  FileText,
  LogOut,
  Bell,
} from "lucide-react";

export type AdminActiveNav = "projects" | "users" | "flags" | "rules" | "audit";

interface AdminNavRailProps {
  activeNav: AdminActiveNav;
  onNavigateTab?: (tab: "projects" | "users") => void;
}

export function AdminNavRail({ activeNav, onNavigateTab }: AdminNavRailProps) {
  const [openFlagsCount, setOpenFlagsCount] = React.useState<number>(0);

  // Poll unread count every 6 seconds
  React.useEffect(() => {
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/admin/notifications/unread-count");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setOpenFlagsCount(data.openFlagsCount || 0);
          }
        }
      } catch {
        // Silently catch background poll failures
      }
    };

    fetchCounts();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCounts();
      }
    }, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleProjectsClick = () => {
    if (onNavigateTab) {
      onNavigateTab("projects");
    } else {
      window.location.href = "/admin?tab=projects";
    }
  };

  const handleUsersClick = () => {
    if (onNavigateTab) {
      onNavigateTab("users");
    } else {
      window.location.href = "/admin?tab=users";
    }
  };

  return (
    <div className="w-16 flex flex-col items-center py-4 bg-bg-app border-r border-border shrink-0 justify-between select-none">
      <div className="flex flex-col items-center gap-6">
        <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-sm">
          <Shield className="w-5 h-5" />
        </div>

        <nav className="flex flex-col gap-2 items-center">
          <button
            onClick={handleProjectsClick}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === "projects"
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Projects & Assignments"
          >
            <FolderKanban className="w-5 h-5" />
          </button>

          <button
            onClick={handleUsersClick}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === "users"
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="User Directory"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Bell Icon with Open Flags Badge */}
          <a
            href="/admin/flags"
            className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === "flags"
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
            title={`Review Queue (${openFlagsCount} open flags)`}
          >
            <Bell className="w-5 h-5" />
            {openFlagsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent text-bg-app text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-bg-app">
                {openFlagsCount > 99 ? "99+" : openFlagsCount}
              </span>
            )}
          </a>

          <a
            href="/admin/flags"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === "flags"
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Flag Review Queue"
          >
            <Flag className="w-5 h-5" />
          </a>

          <a
            href="/admin/rules"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === "rules"
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Content Rules"
          >
            <Sliders className="w-5 h-5" />
          </a>

          <a
            href="/admin/audit"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === "audit"
                ? "bg-accent-soft text-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
            title="Audit Log"
          >
            <FileText className="w-5 h-5" />
          </a>
        </nav>
      </div>

      <button
        onClick={handleLogout}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
        title="Sign out"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}

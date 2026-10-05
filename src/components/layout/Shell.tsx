"use client";

import * as React from "react";
import { MessageSquare, Shield, Settings, Search, Filter, Lock } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";

export interface ShellProps {
  children?: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [activeFilter, setActiveFilter] = React.useState<"all" | "unread" | "archived">("all");
  const [mobileView, setMobileView] = React.useState<"list" | "main">("main");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app select-none">
      {/* Zone 1: Icon Rail (Hidden on small mobile screens < 640px, visible md+) */}
      <aside className="hidden sm:flex flex-col items-center justify-between w-14 shrink-0 bg-bg-app border-r border-border py-3 z-20">
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            title="Confidential Communication Portal"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-accent-soft text-accent hover:opacity-90 transition-opacity"
          >
            <Shield className="w-5 h-5" />
          </button>

          <div className="w-6 h-[1px] bg-border my-1" />

          <button
            title="Chats"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-text-primary bg-bg-surface border border-border"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <button
            title="Settings"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div title="Confidential Session Active" className="p-2 text-text-secondary/60">
            <Lock className="w-4 h-4" />
          </div>
        </div>
      </aside>

      {/* Zone 2: List Panel (Conversations / Channels) */}
      <section
        className={`flex flex-col w-full sm:w-80 md:w-96 shrink-0 bg-bg-panel border-r border-border transition-all ${
          mobileView === "main" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Panel Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-bg-panel shrink-0">
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">
            Chats
          </h1>
          <div className="flex items-center gap-2 text-text-secondary">
            <button
              onClick={() => setMobileView(mobileView === "list" ? "main" : "list")}
              className="md:hidden text-xs px-2 py-1 bg-bg-field rounded border border-border text-text-secondary"
            >
              Toggle Pane
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-2.5 flex flex-col gap-2 border-b border-border/50 bg-bg-panel shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-text-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="Search or start a new chat"
              className="w-full h-8 pl-9 pr-3 rounded bg-bg-field text-xs text-text-primary placeholder:text-text-secondary border border-border focus:outline-none focus:border-text-secondary/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            <Chip
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            >
              All
            </Chip>
            <Chip
              active={activeFilter === "unread"}
              onClick={() => setActiveFilter("unread")}
            >
              Unread
            </Chip>
            <Chip
              active={activeFilter === "archived"}
              onClick={() => setActiveFilter("archived")}
            >
              Archived
            </Chip>
          </div>
        </div>

        {/* Conversation List / Placeholder */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
          <p className="text-xs text-text-secondary leading-relaxed">
            No active conversations yet.
          </p>
          <p className="text-[11px] text-text-secondary/60 mt-1">
            Projects and conversations will appear here once loaded.
          </p>
        </div>
      </section>

      {/* Zone 3: Main Pane (Active Chat or Empty State) */}
      <main
        className={`flex-1 relative flex flex-col h-full bg-bg-app overflow-hidden ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Subtle WhatsApp dark background doodle/mesh overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#e9edef_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Content area */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center h-full p-4 overflow-y-auto">
          {children || <EmptyState />}
        </div>
      </main>
    </div>
  );
}

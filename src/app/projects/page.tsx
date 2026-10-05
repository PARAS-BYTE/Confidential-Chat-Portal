"use client";

import * as React from "react";
import {
  Shield,
  MessageSquare,
  LogOut,
  Search,
  ArrowLeft,
  Send,
  Lock,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  Bell,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ParticipantProjectDTO,
  ParticipantMessageDTO,
  ParticipantNotificationDTO,
} from "@/lib/serializers";

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface PendingMessage {
  clientMessageId: string;
  body: string;
  status: "SENDING" | "FAILED";
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<ParticipantProjectDTO[]>([]);
  const [loadingProjects, setLoadingProjects] = React.useState(true);
  const [projectError, setProjectError] = React.useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [search, setSearch] = React.useState("");

  // Chat state
  const [messages, setMessages] = React.useState<ParticipantMessageDTO[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [inputText, setInputText] = React.useState("");
  const [pendingMessages, setPendingMessages] = React.useState<PendingMessage[]>([]);

  // Notifications state
  const [notifications, setNotifications] = React.useState<ParticipantNotificationDTO[]>([]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);
  const chatScrollContainerRef = React.useRef<HTMLDivElement>(null);

  // 1. Fetch participant projects
  const fetchProjects = React.useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setProjectError(null);
      } else {
        setProjectError("Unable to load conversations");
      }
    } catch {
      setProjectError("Network error while loading projects");
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // 2. Fetch messages for selected project
  const fetchMessages = React.useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);

        // Mark as read in background
        fetch(`/api/projects/${projectId}/read`, { method: "POST" }).catch(() => {});
      }
    } catch {
      // Ignore background poll errors
    }
  }, []);

  // 3. Fetch notifications for current user
  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Ignore background poll errors
    }
  }, []);

  const handleMarkNotificationsRead = async (notificationIds?: string[]) => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      fetchNotifications();
    } catch {
      // Ignore background errors
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchProjects();
    fetchNotifications();
  }, [fetchProjects, fetchNotifications]);

  // Load messages when selected project changes
  React.useEffect(() => {
    if (!selectedProjectId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    fetchMessages(selectedProjectId).finally(() => {
      setLoadingMessages(false);
    });
  }, [selectedProjectId, fetchMessages]);

  // Polling loop (every 3.5 seconds, pauses when tab is hidden)
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchProjects();
        fetchNotifications();
        if (selectedProjectId) {
          fetchMessages(selectedProjectId);
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [selectedProjectId, fetchProjects, fetchMessages, fetchNotifications]);

  // Handle scroll to track if user scrolled up
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    isNearBottomRef.current = scrollHeight - (scrollTop + clientHeight) < 80;
  };

  // Scroll to bottom when new messages arrive (if near bottom)
  React.useEffect(() => {
    if (isNearBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, pendingMessages]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  // Send message handler
  const handleSendMessage = async (textToSend?: string, existingClientId?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !selectedProjectId) return;

    const clientMessageId = existingClientId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // If new message, add to pending list
    if (!existingClientId) {
      setPendingMessages((prev) => [
        ...prev,
        {
          clientMessageId,
          body: text,
          status: "SENDING",
          createdAt: new Date().toISOString(),
        },
      ]);
      setInputText("");
    } else {
      // Set existing pending to SENDING
      setPendingMessages((prev) =>
        prev.map((p) =>
          p.clientMessageId === existingClientId ? { ...p, status: "SENDING" } : p
        )
      );
    }

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, clientMessageId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Remove from pending and add to confirmed messages
        setPendingMessages((prev) =>
          prev.filter((p) => p.clientMessageId !== clientMessageId)
        );
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        // Refresh project previews
        fetchProjects();
      } else {
        // Mark pending as failed
        setPendingMessages((prev) =>
          prev.map((p) =>
            p.clientMessageId === clientMessageId ? { ...p, status: "FAILED" } : p
          )
        );
      }
    } catch {
      setPendingMessages((prev) =>
        prev.map((p) =>
          p.clientMessageId === clientMessageId ? { ...p, status: "FAILED" } : p
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const unreadNotifications = notifications.filter((n) => !n.readAt);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.otherAlias.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "unread" && (p.unreadCount || 0) > 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex h-screen w-full bg-bg-app text-text-primary overflow-hidden select-none">
      {/* Zone 1: Icon Rail (Hidden on small mobile when chat is open) */}
      <div
        className={`w-14 sm:w-16 flex flex-col items-center py-4 bg-bg-app border-r border-border shrink-0 justify-between z-20 ${
          selectedProjectId ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-sm">
            <Shield className="w-5 h-5" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-soft text-accent transition-colors"
              title="Projects & Chats"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {unreadNotifications.length > 0 && (
              <button
                onClick={() => handleMarkNotificationsRead()}
                className="relative w-10 h-10 rounded-lg flex items-center justify-center text-accent hover:bg-bg-hover transition-colors"
                title={`${unreadNotifications.length} unread notification(s) - click to mark all read`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent text-bg-app text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-bg-app">
                  {unreadNotifications.length}
                </span>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Zone 2: Projects List Panel */}
      <section
        className={`flex flex-col w-full sm:w-80 md:w-96 shrink-0 bg-bg-panel border-r border-border transition-all ${
          selectedProjectId ? "hidden sm:flex" : "flex"
        }`}
      >
        {/* Panel Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-bg-panel shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-text-primary tracking-tight">
              Conversations
            </h1>
            <p className="text-[11px] text-text-secondary">Pseudonymous workspace</p>
          </div>
        </div>

        {/* Search & Filter Chips */}
        <div className="p-2.5 flex flex-col gap-2 border-b border-border/50 bg-bg-panel shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-text-secondary pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 h-8 text-xs bg-bg-field rounded-full border-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </Chip>
            <Chip active={filter === "unread"} onClick={() => setFilter("unread")}>
              Unread
            </Chip>
          </div>
        </div>

        {/* Unread Decision Notice in Inbox */}
        {unreadNotifications.length > 0 && (
          <div className="mx-2.5 my-2 p-2 rounded-lg bg-bg-surface border border-accent/40 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 text-text-primary min-w-0 pr-2">
              <Bell className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="truncate text-[11px]">{unreadNotifications[0].text}</span>
            </div>
            <button
              onClick={() => handleMarkNotificationsRead([unreadNotifications[0].id])}
              className="text-[10px] text-accent font-medium hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Project Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {loadingProjects ? (
            <div className="p-3 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : projectError ? (
            <div className="p-6 text-center text-xs text-danger">
              <p>{projectError}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchProjects}
                className="mt-3 gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </Button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-secondary leading-relaxed">
              No conversations assigned yet.
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              const hasUnread = (p.unreadCount || 0) > 0;
              const initials = getInitials(p.otherAlias);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`flex items-center gap-3 px-4 py-3.5 h-[72px] cursor-pointer transition-colors ${
                    isSelected ? "bg-accent-soft/70" : "hover:bg-bg-hover"
                  }`}
                >
                  {/* Avatar circle */}
                  <div className="w-10 h-10 rounded-full bg-bg-surface border border-border flex items-center justify-center shrink-0 font-medium text-xs text-text-secondary">
                    {initials}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {p.title}
                      </span>
                      {p.lastActivityAt && (
                        <span className="text-[10px] text-text-secondary shrink-0 ml-2">
                          {formatTime(p.lastActivityAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-text-secondary truncate">
                        {p.lastMessagePreview || "No messages yet"}
                      </p>
                      {hasUnread && (
                        <span className="w-4 h-4 rounded-full bg-accent text-[10px] font-bold text-bg-app flex items-center justify-center shrink-0 ml-2">
                          {p.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Zone 3: Main Chat Pane */}
      <main
        className={`flex-1 relative flex flex-col h-full bg-bg-app overflow-hidden ${
          !selectedProjectId ? "hidden sm:flex" : "flex"
        }`}
      >
        {/* WhatsApp dark doodle mesh background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#e9edef_1px,transparent_1px)] [background-size:16px_16px]" />

        {selectedProject ? (
          <div className="relative z-10 flex flex-col h-full w-full">
            {/* Chat Header */}
            <div className="h-14 px-4 flex items-center justify-between bg-bg-panel border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="sm:hidden text-text-secondary hover:text-text-primary p-1 -ml-1 rounded"
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-9 h-9 rounded-full bg-bg-surface border border-border flex items-center justify-center shrink-0 text-xs font-medium text-text-secondary">
                  {getInitials(selectedProject.otherAlias)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold text-text-primary truncate">
                      {selectedProject.otherAlias}
                    </h2>
                    <Badge variant="neutral" className="text-[9px] py-0 px-1.5">
                      {selectedProject.title}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-text-secondary truncate">
                    You are speaking as &quot;{selectedProject.myAlias}&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Pinned Required Compliance Notice Card */}
            <div className="mx-4 my-2.5 p-2.5 rounded-lg bg-bg-surface/90 border border-border/80 flex items-start gap-2 text-text-secondary shrink-0">
              <Lock className="w-4 h-4 shrink-0 text-text-secondary/60 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Your identity is hidden from other participants. CCP Studio administrators
                may review conversations for project management and policy compliance.
              </p>
            </div>

            {/* Quiet System Decision Notice Banner */}
            {unreadNotifications.length > 0 && (
              <div className="mx-4 mb-2 p-2.5 rounded-lg bg-bg-surface border border-accent/40 flex items-center justify-between text-xs text-text-secondary shrink-0">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-[11px] text-text-primary">{unreadNotifications[0].text}</span>
                </div>
                <button
                  onClick={() => handleMarkNotificationsRead([unreadNotifications[0].id])}
                  className="text-[10px] bg-bg-field hover:bg-bg-hover text-text-primary px-2 py-1 rounded transition-colors font-medium shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Messages Container */}
            <div
              ref={chatScrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
            >
              {loadingMessages ? (
                <div className="space-y-4 max-w-sm mx-auto p-4">
                  <Skeleton className="h-12 w-3/4 ml-auto rounded-lg" />
                  <Skeleton className="h-12 w-3/4 rounded-lg" />
                  <Skeleton className="h-12 w-1/2 ml-auto rounded-lg" />
                </div>
              ) : messages.length === 0 && pendingMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-text-secondary">
                  <p className="text-xs">No messages yet.</p>
                  <p className="text-[11px] text-text-secondary/70 mt-1">
                    Send a message to begin confidential project discussion.
                  </p>
                </div>
              ) : (
                <>
                  {/* Quiet System Notices in Chat */}
                  {notifications.slice(0, 3).map((n) => (
                    <div key={`system-notice-${n.id}`} className="flex justify-center my-2 select-none">
                      <span className="text-[11px] bg-bg-surface/90 text-text-secondary px-3 py-1 rounded-full border border-border/60 text-center shadow-sm">
                        {n.text}
                      </span>
                    </div>
                  ))}

                  {messages.map((m) => {
                    const isMine = m.isMine;
                    const isHeld = m.status === "HELD";

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-lg text-xs leading-relaxed relative ${
                            isMine
                              ? isHeld
                                ? "bg-bg-surface border border-warn text-text-primary"
                                : "bg-bubble-out text-text-primary"
                              : "bg-bubble-in text-text-primary"
                          }`}
                        >
                          {/* Sender alias (for other party) */}
                          {!isMine && (
                            <div className="text-[10px] font-semibold text-accent mb-0.5">
                              {m.senderAlias}
                            </div>
                          )}

                          {/* Message Body */}
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>

                          {/* Held state banner */}
                          {isHeld && isMine && (
                            <div className="mt-1.5 pt-1.5 border-t border-warn/30 flex items-center gap-1.5 text-[10px] text-warn">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>Held for review. An administrator will check this message.</span>
                            </div>
                          )}

                          {/* Bubble Footer: Time & Status Tick */}
                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-text-secondary/80">
                            <span>{formatTime(m.createdAt)}</span>
                            {isMine && !isHeld && (
                              <CheckCheck className="w-3.5 h-3.5 text-accent" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pending / In-flight Messages */}
                  {pendingMessages.map((p) => (
                    <div key={p.clientMessageId} className="flex flex-col items-end">
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-lg text-xs leading-relaxed ${
                          p.status === "FAILED"
                            ? "bg-bg-surface border border-danger text-text-primary"
                            : "bg-bubble-out/80 text-text-primary"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{p.body}</div>

                        <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-text-secondary/80">
                          <span>{formatTime(p.createdAt)}</span>
                          {p.status === "SENDING" ? (
                            <Clock className="w-3 h-3 text-text-secondary" />
                          ) : (
                            <div className="flex items-center gap-1 text-danger">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <button
                                onClick={() => handleSendMessage(p.body, p.clientMessageId)}
                                className="underline hover:text-danger/90 font-medium"
                              >
                                Retry
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Composer Bar */}
            <div className="p-3 bg-bg-panel border-t border-border shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2 max-w-4xl mx-auto"
              >
                <div className="relative flex-1">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a confidential message..."
                    className="w-full h-10 px-4 bg-bg-field rounded-full text-xs text-text-primary placeholder:text-text-secondary border-none focus:ring-1 focus:ring-text-secondary/50"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="icon"
                  disabled={!inputText.trim()}
                  className="w-10 h-10 rounded-full shrink-0"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              title="Confidential Communication Portal"
              description="Select a project from the left panel to review or send secure messages. All participants communicate strictly through project-scoped aliases."
            />
          </div>
        )}
      </main>
    </div>
  );
}

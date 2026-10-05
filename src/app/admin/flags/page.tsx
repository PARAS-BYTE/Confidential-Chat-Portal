"use client";

import * as React from "react";
import {
  Flag,
  FolderKanban,
  Users,
  Sliders,
  FileText,
  LogOut,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  ArrowLeft,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface FlagItem {
  id: string;
  category: "CONTACT" | "OFF_PLATFORM" | "COMMERCIAL" | "ABUSE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "APPROVED" | "REJECTED" | "DISMISSED";
  reason: string;
  matchedText: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewedBy?: { id: string; realName: string; email: string } | null;
  message: {
    id: string;
    body: string;
    status: string;
    createdAt: string;
    conversation: {
      project: { id: string; title: string };
    };
    senderMembership: {
      alias: string;
      role: string;
      user: {
        id: string;
        realName: string;
        email: string;
        phone: string | null;
        role: string;
      };
    };
  };
}

interface FlagDetailData {
  flag: FlagItem;
  context: {
    messagesBefore: Array<{ id: string; body: string; createdAt: string; senderMembership: { alias: string } }>;
    message: { id: string; body: string; createdAt: string; status: string };
    messagesAfter: Array<{ id: string; body: string; createdAt: string; senderMembership: { alias: string } }>;
  };
  auditHistory: Array<{ id: string; action: string; createdAt: string; actor: { realName: string }; metadata: any }>;
}

export default function FlagsReviewPage() {
  const { showToast } = useToast();

  const [flags, setFlags] = React.useState<FlagItem[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [selectedFlagId, setSelectedFlagId] = React.useState<string | null>(null);

  const [detailData, setDetailData] = React.useState<FlagDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>("OPEN");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");

  // Decision state
  const [decisionNote, setDecisionNote] = React.useState("");
  const [submittingDecision, setSubmittingDecision] = React.useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = React.useState(false);

  // Fetch flags list
  const fetchFlags = React.useCallback(async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/flags?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || []);
        if (data.flags && data.flags.length > 0 && !selectedFlagId) {
          setSelectedFlagId(data.flags[0].id);
        }
      }
    } catch {
      showToast("Failed to load review flags", "error");
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, categoryFilter, search, selectedFlagId, showToast]);

  // Fetch flag detail & context
  const fetchDetail = React.useCallback(async (flagId: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/admin/flags/${flagId}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch {
      showToast("Failed to load conversation context", "error");
    } finally {
      setLoadingDetail(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  React.useEffect(() => {
    if (selectedFlagId) {
      fetchDetail(selectedFlagId);
      setDecisionNote("");
    } else {
      setDetailData(null);
    }
  }, [selectedFlagId, fetchDetail]);

  const handleDecision = async (decision: "APPROVE" | "REJECT" | "DISMISS") => {
    if (!selectedFlagId) return;

    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/admin/flags/${selectedFlagId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: decisionNote.trim() || undefined }),
      });

      if (res.ok) {
        const actionLabel =
          decision === "APPROVE"
            ? "Message approved and delivered"
            : decision === "REJECT"
            ? "Message rejected"
            : "Dismissed as false positive and delivered";

        showToast(actionLabel, "success");
        setIsRejectConfirmOpen(false);
        setDecisionNote("");
        await fetchDetail(selectedFlagId);
        await fetchFlags();
      } else {
        const err = await res.json();
        showToast(err.error || "Decision could not be applied", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen w-full bg-bg-app text-text-primary overflow-hidden select-none">
      {/* Zone 1: Icon Rail */}
      <div className="w-16 flex flex-col items-center py-4 bg-bg-app border-r border-border shrink-0 justify-between">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-sm">
            <Shield className="w-5 h-5" />
          </div>

          <nav className="flex flex-col gap-2">
            <a
              href="/admin"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Projects & Users"
            >
              <FolderKanban className="w-5 h-5" />
            </a>

            <button
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-soft text-accent transition-colors"
              title="Flag Review Queue"
            >
              <Flag className="w-5 h-5" />
            </button>

            <a
              href="/admin/rules"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Content Rules"
            >
              <Sliders className="w-5 h-5" />
            </a>

            <a
              href="/admin/audit"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
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

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone 2: Flags List Queue */}
        <div className="w-80 md:w-96 bg-bg-panel border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <h1 className="text-sm font-semibold text-text-primary">Review Queue</h1>
            <p className="text-[11px] text-text-secondary">Messages intercepted for moderation</p>
          </div>

          {/* Search & Status Filters */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search flagged content..."
                className="pl-9 h-8 text-xs bg-bg-field rounded-full border-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {["OPEN", "ALL", "APPROVED", "REJECTED", "DISMISSED"].map((st) => (
                <Chip
                  key={st}
                  active={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  className="text-[11px]"
                >
                  {st.charAt(0) + st.slice(1).toLowerCase()}
                </Chip>
              ))}
            </div>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loadingList ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : flags.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-secondary">
                No flags matching current filters
              </div>
            ) : (
              flags.map((f) => {
                const isSelected = f.id === selectedFlagId;
                const isHeld = f.message.status === "HELD";

                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFlagId(f.id)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-accent-soft/70" : "hover:bg-bg-hover"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {f.message.conversation.project.title}
                      </span>
                      <Badge
                        variant={
                          f.status === "OPEN"
                            ? isHeld
                              ? "warn"
                              : "neutral"
                            : f.status === "APPROVED"
                            ? "neutral"
                            : "danger"
                        }
                        className="text-[10px]"
                      >
                        {f.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary">
                      <span className="font-semibold text-text-primary">
                        {f.message.senderMembership.alias}
                      </span>
                      <span>•</span>
                      <span className="text-warn">{f.category}</span>
                    </div>

                    <p className="text-[11px] text-text-secondary/80 mt-1 truncate">
                      Matched: &quot;{f.matchedText}&quot;
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Zone 3: Flag Detail & Decision Pane */}
        <div className="flex-1 bg-bg-app flex flex-col overflow-y-auto">
          {loadingDetail ? (
            <div className="p-8 max-w-4xl mx-auto space-y-4 w-full">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : detailData ? (
            <div className="p-6 max-w-4xl w-full mx-auto space-y-6">
              {/* Summary Banner */}
              <Card className="bg-bg-surface border-border p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-medium text-text-primary">
                        {detailData.flag.message.conversation.project.title}
                      </h2>
                      <Badge
                        variant={
                          detailData.flag.status === "OPEN" ? "warn" : "neutral"
                        }
                      >
                        {detailData.flag.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      Reason: {detailData.flag.reason}
                    </p>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-text-secondary">Severity: </span>
                    <span className="font-semibold text-warn">
                      {detailData.flag.severity}
                    </span>
                  </div>
                </div>

                {/* Identity breakdown (Admin Privileged View) */}
                <div className="p-3 rounded-lg bg-bg-field text-xs grid grid-cols-1 sm:grid-cols-2 gap-3 border border-border">
                  <div>
                    <span className="text-text-secondary block text-[10px]">
                      Sender Project Alias:
                    </span>
                    <span className="font-semibold text-accent">
                      {detailData.flag.message.senderMembership.alias} (
                      {detailData.flag.message.senderMembership.role})
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-[10px]">
                      Real Identity (Admin Only):
                    </span>
                    <span className="font-medium text-text-primary">
                      {detailData.flag.message.senderMembership.user.realName} (
                      {detailData.flag.message.senderMembership.user.email})
                    </span>
                  </div>
                </div>

                {/* Matched pattern alert */}
                <div className="p-3 rounded bg-warn/10 border border-warn/30 text-xs text-warn flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Matched Trigger Phrase:{" "}
                    <strong className="underline underline-offset-2">
                      &quot;{detailData.flag.matchedText}&quot;
                    </strong>
                  </span>
                </div>
              </Card>

              {/* Conversation Context Box */}
              <Card className="bg-bg-surface border-border p-5">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">
                  Conversation Context
                </h3>

                <div className="space-y-3 border-l-2 border-border pl-4">
                  {/* Preceding messages */}
                  {detailData.context.messagesBefore.map((m) => (
                    <div key={m.id} className="text-xs opacity-60">
                      <div className="text-[10px] font-medium text-text-secondary">
                        {m.senderMembership.alias} • {new Date(m.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-text-primary mt-0.5">{m.body}</div>
                    </div>
                  ))}

                  {/* Flagged Message Highlight */}
                  <div className="p-3.5 rounded-lg bg-warn/10 border-2 border-warn text-xs relative my-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-warn mb-1">
                      <span>
                        {detailData.flag.message.senderMembership.alias} (FLAGGED MESSAGE)
                      </span>
                      <span>
                        {new Date(detailData.context.message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-text-primary text-sm font-medium whitespace-pre-wrap">
                      {detailData.context.message.body}
                    </div>
                    <div className="text-[10px] text-warn/80 mt-2 font-mono">
                      Current Message Status: {detailData.context.message.status}
                    </div>
                  </div>

                  {/* Following messages */}
                  {detailData.context.messagesAfter.map((m) => (
                    <div key={m.id} className="text-xs opacity-60">
                      <div className="text-[10px] font-medium text-text-secondary">
                        {m.senderMembership.alias} • {new Date(m.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-text-primary mt-0.5">{m.body}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Action Decision Section */}
              <Card className="bg-bg-surface border-border p-5">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">
                  Moderator Decision
                </h3>

                {detailData.flag.status === "OPEN" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-text-secondary block mb-1">
                        Reviewer Note (Optional internal rationale):
                      </label>
                      <Input
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="e.g. Cleared after verification, or Prohibited phone solicitation"
                        className="bg-bg-field text-xs"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Button
                        variant="primary"
                        onClick={() => handleDecision("APPROVE")}
                        disabled={submittingDecision}
                        className="gap-2 h-9 text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve message</span>
                      </Button>

                      <Button
                        variant="danger"
                        onClick={() => setIsRejectConfirmOpen(true)}
                        disabled={submittingDecision}
                        className="gap-2 h-9 text-xs"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject message</span>
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => handleDecision("DISMISS")}
                        disabled={submittingDecision}
                        className="gap-2 h-9 text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-text-secondary" />
                        <span>Dismiss as false positive</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-bg-field text-xs space-y-2 border border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary">Decision:</span>
                      <Badge
                        variant={
                          detailData.flag.status === "APPROVED"
                            ? "neutral"
                            : detailData.flag.status === "REJECTED"
                            ? "danger"
                            : "neutral"
                        }
                      >
                        {detailData.flag.status}
                      </Badge>
                    </div>
                    {detailData.flag.reviewedBy && (
                      <div className="text-text-secondary text-[11px]">
                        Reviewed by {detailData.flag.reviewedBy.realName} on{" "}
                        {detailData.flag.reviewedAt
                          ? new Date(detailData.flag.reviewedAt).toLocaleString()
                          : "—"}
                      </div>
                    )}
                    {detailData.flag.reviewNote && (
                      <div className="text-text-primary text-xs mt-1">
                        Note: &quot;{detailData.flag.reviewNote}&quot;
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Audit History Block */}
              {detailData.auditHistory.length > 0 && (
                <Card className="bg-bg-surface border-border p-5">
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
                    Audit Trail
                  </h3>
                  <div className="divide-y divide-border/40 text-xs">
                    {detailData.auditHistory.map((a) => (
                      <div key={a.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-text-primary">
                            {a.actor.realName}
                          </span>{" "}
                          <span className="text-text-secondary">
                            performed {a.action}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-secondary">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-xs text-text-secondary">
              Select a flagged message from the left queue to review context and make a decision
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Reject */}
      <Modal
        isOpen={isRejectConfirmOpen}
        onClose={() => setIsRejectConfirmOpen(false)}
        title="Reject Flagged Message"
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-secondary">
            Are you sure you want to reject this message? It will remain permanently
            undelivered to the recipient.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRejectConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDecision("REJECT")}
              disabled={submittingDecision}
            >
              {submittingDecision ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  FileText,
  FolderKanban,
  Flag,
  Sliders,
  LogOut,
  Shield,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface AuditItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: any;
  createdAt: string;
  actor: {
    id: string;
    realName: string;
    email: string;
    role: string;
  };
}

export default function AuditPage() {
  const { showToast } = useToast();

  const [events, setEvents] = React.useState<AuditItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);

  const [actionFilter, setActionFilter] = React.useState("");

  const fetchAudit = React.useCallback(async (p: number, action: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "25");
      if (action) params.set("action", action);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      showToast("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    fetchAudit(page, actionFilter);
  }, [page, actionFilter, fetchAudit]);

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

            <a
              href="/admin/flags"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Review Flags"
            >
              <Flag className="w-5 h-5" />
            </a>

            <a
              href="/admin/rules"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Content Rules"
            >
              <Sliders className="w-5 h-5" />
            </a>

            <button
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-soft text-accent transition-colors"
              title="Audit Log"
            >
              <FileText className="w-5 h-5" />
            </button>
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
      <div className="flex-1 bg-bg-app flex flex-col p-6 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium text-text-primary">Audit Log</h1>
              <p className="text-xs text-text-secondary">
                Immutable security trail of administrative actions, decisions, and membership alterations
              </p>
            </div>

            {/* Filter by Action */}
            <div className="flex items-center gap-2">
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="USER_CREATED">USER_CREATED</option>
                <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
                <option value="USER_REACTIVATED">USER_REACTIVATED</option>
                <option value="PROJECT_CREATED">PROJECT_CREATED</option>
                <option value="MEMBER_ASSIGNED">MEMBER_ASSIGNED</option>
                <option value="MEMBER_REMOVED">MEMBER_REMOVED</option>
                <option value="FLAG_DECISION">FLAG_DECISION</option>
                <option value="RULE_CREATED">RULE_CREATED</option>
                <option value="RULE_UPDATED">RULE_UPDATED</option>
              </select>
            </div>
          </div>

          {/* Audit Events Table */}
          <Card className="bg-bg-surface border-border p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="pb-2.5 font-medium">Timestamp</th>
                    <th className="pb-2.5 font-medium">Actor</th>
                    <th className="pb-2.5 font-medium">Action</th>
                    <th className="pb-2.5 font-medium">Target</th>
                    <th className="pb-2.5 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-secondary">
                        No audit events recorded yet
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-bg-hover/40">
                        <td className="py-3 pr-4 text-text-secondary whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-text-primary">
                            {ev.actor?.realName || "System"}
                          </span>
                          <span className="text-[10px] text-text-secondary block">
                            {ev.actor?.email}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="neutral" className="text-[10px]">
                            {ev.action}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-text-secondary text-[11px]">
                            {ev.targetType}
                          </span>
                          <span className="font-mono text-[10px] text-text-secondary/70 block truncate max-w-[120px]">
                            {ev.targetId}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <code className="text-[10px] font-mono text-text-secondary bg-bg-field px-1.5 py-0.5 rounded max-w-xs block truncate">
                            {JSON.stringify(ev.metadata)}
                          </code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border text-xs text-text-secondary">
                <span>
                  Showing page {page} of {totalPages} ({total} total events)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

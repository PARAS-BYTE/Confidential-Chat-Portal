"use client";

import * as React from "react";
import {
  Sliders,
  FolderKanban,
  Flag,
  FileText,
  LogOut,
  Shield,
  Plus,
  Lock,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { AdminNavRail } from "@/components/layout/AdminNavRail";

interface RuleItem {
  id: string;
  name: string;
  category: "CONTACT" | "OFF_PLATFORM" | "COMMERCIAL" | "ABUSE";
  pattern: string;
  patternType: "KEYWORD" | "REGEX";
  severity: "LOW" | "MEDIUM" | "HIGH";
  action: "ALLOW_FLAG" | "HOLD";
  isActive: boolean;
  isLocked: boolean;
}

interface TestResult {
  finalAction: "DELIVERED" | "HOLD";
  matches: Array<{
    category: string;
    severity: string;
    reason: string;
    matchedText: string;
    action: string;
  }>;
}

export default function RulesPage() {
  const { showToast } = useToast();

  const [rules, setRules] = React.useState<RuleItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Live test state
  const [testText, setTestText] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);

  // Add rule modal
  const [isAddRuleOpen, setIsAddRuleOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newCategory, setNewCategory] = React.useState<"CONTACT" | "OFF_PLATFORM" | "COMMERCIAL" | "ABUSE">("OFF_PLATFORM");
  const [newPattern, setNewPattern] = React.useState("");
  const [newPatternType, setNewPatternType] = React.useState<"KEYWORD" | "REGEX">("KEYWORD");
  const [newSeverity, setNewSeverity] = React.useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [newAction, setNewAction] = React.useState<"ALLOW_FLAG" | "HOLD">("HOLD");
  const [submittingRule, setSubmittingRule] = React.useState(false);

  const fetchRules = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      showToast("Failed to load rules", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Update rule toggle or action
  const handleUpdateRule = async (
    ruleId: string,
    updates: { action?: "ALLOW_FLAG" | "HOLD"; isActive?: boolean }
  ) => {
    try {
      const res = await fetch(`/api/admin/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        showToast("Rule updated successfully", "success");
        await fetchRules();
      } else {
        const err = await res.json();
        showToast(err.error || "Cannot update rule", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    }
  };

  // Run live test simulation
  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testText.trim()) return;

    setTesting(true);
    try {
      const res = await fetch("/api/admin/rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: testText }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      } else {
        const err = await res.json();
        showToast(err.error || "Test simulation failed", "error");
      }
    } catch {
      showToast("Simulation network error", "error");
    } finally {
      setTesting(false);
    }
  };

  // Create rule handler
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPattern.trim()) return;

    setSubmittingRule(true);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          pattern: newPattern.trim(),
          patternType: newPatternType,
          severity: newSeverity,
          action: newCategory === "CONTACT" ? "HOLD" : newAction,
        }),
      });

      if (res.ok) {
        showToast("Custom rule created successfully", "success");
        setIsAddRuleOpen(false);
        setNewName("");
        setNewPattern("");
        await fetchRules();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create rule", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const categories: Array<"CONTACT" | "OFF_PLATFORM" | "COMMERCIAL" | "ABUSE"> = [
    "CONTACT",
    "OFF_PLATFORM",
    "COMMERCIAL",
    "ABUSE",
  ];

  return (
    <div className="flex h-screen w-full bg-bg-app text-text-primary overflow-hidden select-none">
      {/* Zone 1: Icon Rail */}
      <AdminNavRail activeNav="rules" />

      {/* Main Container */}
      <div className="flex-1 bg-bg-app flex flex-col p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium text-text-primary">Content Moderation Rules</h1>
              <p className="text-xs text-text-secondary">
                Configure interception policies, keyword triggers, and action thresholds
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddRuleOpen(true)}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rule</span>
            </Button>
          </div>

          {/* Test a Message Live Simulator Box */}
          <Card className="bg-bg-surface border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-accent" />
                <span>Simulate Rule Engine Evaluation</span>
              </h2>
              {testResult && (
                <button
                  onClick={() => setTestResult(null)}
                  className="text-text-secondary hover:text-text-primary text-[11px] flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <form onSubmit={handleRunTest} className="flex gap-2">
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Type any test sentence (e.g. 'Call me on 9876543210' or 'Price is $500')..."
                className="bg-bg-field text-xs flex-1"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={testing || !testText.trim()}
                className="text-xs shrink-0"
              >
                {testing ? "Evaluating..." : "Test Message"}
              </Button>
            </form>

            {/* Test Results Output */}
            {testResult && (
              <div className="mt-3 p-3.5 rounded-lg bg-bg-field border border-border text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Final System Action:</span>
                  <Badge
                    variant={testResult.finalAction === "HOLD" ? "warn" : "neutral"}
                    className={testResult.finalAction === "DELIVERED" ? "bg-accent-soft text-accent" : ""}
                  >
                    {testResult.finalAction === "HOLD" ? "HELD FOR REVIEW" : "DELIVERED INSTANTLY"}
                  </Badge>
                </div>

                {testResult.matches.length === 0 ? (
                  <p className="text-accent text-[11px] flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No policy violations detected. Message will be delivered cleanly.</span>
                  </p>
                ) : (
                  <div className="space-y-1.5 mt-2">
                    <span className="text-text-secondary text-[11px] block">Triggered Rules:</span>
                    {testResult.matches.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-bg-surface border border-border text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-text-primary">{m.reason}</strong>{" "}
                          <span className="text-text-secondary">({m.category})</span>
                          <span className="text-warn ml-2">Matched: &quot;{m.matchedText}&quot;</span>
                        </div>
                        <Badge variant={m.action === "HOLD" ? "warn" : "neutral"} className="text-[10px]">
                          {m.action}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Grouped Rules Section */}
          <div className="space-y-6">
            {categories.map((cat) => {
              const catRules = rules.filter((r) => r.category === cat);
              const isLockedCategory = cat === "CONTACT";

              return (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                        {cat} Rules
                      </h3>
                      {isLockedCategory && (
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary bg-bg-field px-2 py-0.5 rounded border border-border">
                          <Lock className="w-3 h-3 text-warn" />
                          <span>LOCKED TO HOLD</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">{catRules.length} rules</span>
                  </div>

                  <Card className="bg-bg-surface border-border divide-y divide-border/40 overflow-hidden">
                    {catRules.length === 0 ? (
                      <div className="p-4 text-center text-xs text-text-secondary">
                        No rules configured in this category.
                      </div>
                    ) : (
                      catRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-bg-hover/30 transition-colors"
                        >
                          <div className="space-y-1 max-w-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-primary">
                                {rule.name}
                              </span>
                              <Badge variant="neutral" className="text-[10px]">
                                {rule.patternType}
                              </Badge>
                              <Badge variant="neutral" className="text-[10px]">
                                {rule.severity}
                              </Badge>
                            </div>
                            <code className="text-[11px] font-mono text-text-secondary/90 bg-bg-field px-1.5 py-0.5 rounded">
                              {rule.pattern}
                            </code>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Action selector */}
                            {isLockedCategory ? (
                              <Badge variant="warn" className="text-[10px]">
                                STRICT HOLD
                              </Badge>
                            ) : (
                              <select
                                value={rule.action}
                                onChange={(e) =>
                                  handleUpdateRule(rule.id, {
                                    action: e.target.value as any,
                                  })
                                }
                                className="h-7 rounded bg-bg-field border border-border px-2 text-[11px] text-text-primary focus:outline-none"
                              >
                                <option value="HOLD">HOLD</option>
                                <option value="ALLOW_FLAG">ALLOW_FLAG</option>
                              </select>
                            )}

                            {/* Active toggle */}
                            <Button
                              variant={rule.isActive ? "secondary" : "danger"}
                              size="sm"
                              onClick={() =>
                                handleUpdateRule(rule.id, {
                                  isActive: !rule.isActive,
                                })
                              }
                              className="h-7 text-[11px] px-2.5"
                            >
                              {rule.isActive ? "Active" : "Disabled"}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal: Add Rule */}
      <Modal
        isOpen={isAddRuleOpen}
        onClose={() => setIsAddRuleOpen(false)}
        title="Add Custom Moderation Rule"
        description="Add a new pattern trigger to intercept prohibited communications."
      >
        <form onSubmit={handleCreateRule} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Rule Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. External Meeting Links"
              required
              className="bg-bg-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-text-secondary font-medium">Category</label>
              <select
                value={newCategory}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setNewCategory(val);
                  if (val === "CONTACT") setNewAction("HOLD");
                }}
                className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="OFF_PLATFORM">OFF_PLATFORM</option>
                <option value="COMMERCIAL">COMMERCIAL</option>
                <option value="ABUSE">ABUSE</option>
                <option value="CONTACT">CONTACT (Locked HOLD)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-text-secondary font-medium">Pattern Type</label>
              <select
                value={newPatternType}
                onChange={(e) => setNewPatternType(e.target.value as any)}
                className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="KEYWORD">KEYWORD</option>
                <option value="REGEX">REGEX</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">
              Pattern ({newPatternType === "REGEX" ? "Regular Expression" : "Keyword"})
            </label>
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder={newPatternType === "REGEX" ? "\\b(zoom\\.us|meet\\.google)\\b" : "call me"}
              required
              className="bg-bg-field font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-text-secondary font-medium">Severity</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value as any)}
                className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-text-secondary font-medium">Action</label>
              <select
                value={newAction}
                disabled={newCategory === "CONTACT"}
                onChange={(e) => setNewAction(e.target.value as any)}
                className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none disabled:opacity-50"
              >
                <option value="HOLD">HOLD</option>
                <option value="ALLOW_FLAG">ALLOW_FLAG</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddRuleOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingRule}
            >
              {submittingRule ? "Creating..." : "Save Rule"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

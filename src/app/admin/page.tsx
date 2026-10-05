"use client";

import * as React from "react";
import {
  FolderKanban,
  Users,
  Flag,
  Sliders,
  FileText,
  LogOut,
  Plus,
  Shield,
  Search,
  UserCheck,
  UserX,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

type AdminTab = "projects" | "users" | "flags" | "rules" | "audit";

interface UserItem {
  id: string;
  realName: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "CLIENT" | "EMPLOYEE";
  isActive: boolean;
  createdAt: string;
  _count?: { memberships: number };
}

interface MembershipItem {
  id: string;
  alias: string;
  role: "ADMIN" | "CLIENT" | "EMPLOYEE";
  status: "ACTIVE" | "REMOVED";
  removedAt: string | null;
  user: {
    id: string;
    realName: string;
    email: string;
    phone: string | null;
    role: string;
    isActive: boolean;
  };
}

interface ProjectItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  memberships: MembershipItem[];
  conversation?: { id: string; _count: { messages: number } };
}

export default function AdminPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("projects");

  // Projects state
  const [projects, setProjects] = React.useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [projectSearch, setProjectSearch] = React.useState("");

  // Users state
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [userSearch, setUserSearch] = React.useState("");

  // Modals state
  const [isCreateProjectOpen, setIsCreateProjectOpen] = React.useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = React.useState(false);
  const [isAssignMemberOpen, setIsAssignMemberOpen] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<MembershipItem | null>(null);
  const [userToToggle, setUserToToggle] = React.useState<UserItem | null>(null);

  // Form states
  const [newProjectTitle, setNewProjectTitle] = React.useState("");
  const [newProjectDesc, setNewProjectDesc] = React.useState("");
  const [submittingProject, setSubmittingProject] = React.useState(false);

  const [newUserName, setNewUserName] = React.useState("");
  const [newUserEmail, setNewUserEmail] = React.useState("");
  const [newUserPhone, setNewUserPhone] = React.useState("");
  const [newUserRole, setNewUserRole] = React.useState<"ADMIN" | "CLIENT" | "EMPLOYEE">("CLIENT");
  const [newUserPassword, setNewUserPassword] = React.useState("");
  const [submittingUser, setSubmittingUser] = React.useState(false);

  const [assignUserId, setAssignUserId] = React.useState("");
  const [assignRole, setAssignRole] = React.useState<"CLIENT" | "EMPLOYEE">("CLIENT");
  const [submittingAssign, setSubmittingAssign] = React.useState(false);

  // Fetch projects
  const fetchProjects = React.useCallback(async () => {
    try {
      setProjectsLoading(true);
      const res = await fetch("/api/admin/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data.projects[0].id);
        }
      }
    } catch {
      showToast("Failed to load projects", "error");
    } finally {
      setProjectsLoading(false);
    }
  }, [selectedProjectId, showToast]);

  // Fetch users
  const fetchUsers = React.useCallback(async () => {
    try {
      setUsersLoading(true);
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      showToast("Failed to load users", "error");
    } finally {
      setUsersLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, [fetchProjects, fetchUsers]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  // Create Project handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    setSubmittingProject(true);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast("Project created successfully", "success");
        setIsCreateProjectOpen(false);
        setNewProjectTitle("");
        setNewProjectDesc("");
        await fetchProjects();
        setSelectedProjectId(data.project.id);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create project", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmittingProject(false);
    }
  };

  // Create User handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) return;

    setSubmittingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realName: newUserName.trim(),
          email: newUserEmail.trim(),
          phone: newUserPhone.trim() || undefined,
          role: newUserRole,
          password: newUserPassword,
        }),
      });

      if (res.ok) {
        showToast("User account created successfully", "success");
        setIsCreateUserOpen(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPhone("");
        setNewUserPassword("");
        await fetchUsers();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create user", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmittingUser(false);
    }
  };

  // Toggle User active state
  const handleToggleActive = async () => {
    if (!userToToggle) return;
    try {
      const res = await fetch(`/api/admin/users/${userToToggle.id}/toggle-active`, {
        method: "POST",
      });
      if (res.ok) {
        showToast(
          userToToggle.isActive ? "User deactivated and sessions revoked" : "User reactivated",
          "success"
        );
        setUserToToggle(null);
        await fetchUsers();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update user status", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    }
  };

  // Assign Member handler
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !assignUserId) return;

    setSubmittingAssign(true);
    try {
      const res = await fetch(`/api/admin/projects/${selectedProjectId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: assignUserId,
          role: assignRole,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(
          `Assigned ${data.membership.user.realName} as ${data.membership.alias}`,
          "success"
        );
        setIsAssignMemberOpen(false);
        setAssignUserId("");
        await fetchProjects();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to assign member", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Remove Member handler
  const handleRemoveMember = async () => {
    if (!selectedProjectId || !memberToRemove) return;
    try {
      const res = await fetch(
        `/api/admin/projects/${selectedProjectId}/memberships/${memberToRemove.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        showToast(`Revoked access for ${memberToRemove.alias}`, "success");
        setMemberToRemove(null);
        await fetchProjects();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to revoke membership", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredUsers = users.filter(
    (u) =>
      u.realName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full bg-bg-app text-text-primary overflow-hidden select-none">
      {/* Zone 1: Icon Rail */}
      <div className="w-16 flex flex-col items-center py-4 bg-bg-app border-r border-border shrink-0 justify-between">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-sm">
            <Shield className="w-5 h-5" />
          </div>

          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab("projects")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === "projects"
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
              title="Projects & Assignments"
            >
              <FolderKanban className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === "users"
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
              title="User Directory"
            >
              <Users className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                window.location.href = "/admin/flags";
              }}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Moderation Flags"
            >
              <Flag className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                window.location.href = "/admin/rules";
              }}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Content Rules"
            >
              <Sliders className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                window.location.href = "/admin/audit";
              }}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
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

      {/* Main Administrative Container */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "projects" && (
          <>
            {/* Zone 2: Projects List */}
            <div className="w-80 md:w-96 bg-bg-panel border-r border-border flex flex-col shrink-0">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-semibold text-text-primary">Projects</h1>
                  <p className="text-[11px] text-text-secondary">Confidential client scopes</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="gap-1.5 h-8 text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </Button>
              </div>

              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <Input
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="pl-9 h-8 text-xs bg-bg-field rounded-full border-none"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                {projectsLoading ? (
                  <div className="p-3 space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="p-6 text-center text-xs text-text-secondary">
                    No projects found
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const isSelected = p.id === selectedProjectId;
                    const activeMembers = p.memberships.filter((m) => m.status === "ACTIVE");
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`p-3.5 cursor-pointer transition-colors ${
                          isSelected ? "bg-accent-soft/70" : "hover:bg-bg-hover"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-medium text-text-primary truncate">
                            {p.title}
                          </span>
                          <Badge variant="neutral" className="text-[10px]">
                            {p.status}
                          </Badge>
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-text-secondary truncate mt-1">
                            {p.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-text-secondary">
                          <span>{activeMembers.length} active members</span>
                          <span>•</span>
                          <span>{p.conversation?._count.messages || 0} messages</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Zone 3: Project Detail & Member Management */}
            <div className="flex-1 bg-bg-app flex flex-col overflow-y-auto">
              {selectedProject ? (
                <div className="p-6 max-w-5xl w-full mx-auto space-y-6">
                  {/* Project Overview Card */}
                  <Card className="bg-bg-surface border-border p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-medium text-text-primary">
                            {selectedProject.title}
                          </h2>
                          <Badge variant="neutral">{selectedProject.status}</Badge>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          {selectedProject.description || "No project description provided."}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-[11px] text-text-secondary/70">
                          <span>ID: {selectedProject.id}</span>
                          <span>
                            Created: {new Date(selectedProject.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAssignMemberOpen(true)}
                        className="gap-1.5 h-8 text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign Member</span>
                      </Button>
                    </div>
                  </Card>

                  {/* Members Table */}
                  <Card className="bg-bg-surface border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-medium text-text-primary">
                          Project Memberships
                        </h3>
                        <p className="text-xs text-text-secondary">
                          Real identities mapped to pseudonymous project aliases
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border text-text-secondary">
                            <th className="pb-2.5 font-medium">Real Identity</th>
                            <th className="pb-2.5 font-medium">System Role</th>
                            <th className="pb-2.5 font-medium">Project Alias</th>
                            <th className="pb-2.5 font-medium">Status</th>
                            <th className="pb-2.5 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {selectedProject.memberships.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-text-secondary">
                                No members assigned to this project yet.
                              </td>
                            </tr>
                          ) : (
                            selectedProject.memberships.map((m) => {
                              const isActive = m.status === "ACTIVE";
                              return (
                                <tr key={m.id} className="hover:bg-bg-hover/50">
                                  <td className="py-3 pr-4">
                                    <div className="font-medium text-text-primary">
                                      {m.user.realName}
                                    </div>
                                    <div className="text-[11px] text-text-secondary">
                                      {m.user.email}
                                    </div>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <Badge variant="neutral">{m.role}</Badge>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span className="font-medium text-accent">
                                      {m.alias}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-4">
                                    {isActive ? (
                                      <Badge variant="neutral" className="text-accent bg-accent-soft">
                                        ACTIVE
                                      </Badge>
                                    ) : (
                                      <Badge variant="danger">REMOVED</Badge>
                                    )}
                                  </td>
                                  <td className="py-3 text-right">
                                    {isActive && (
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => setMemberToRemove(m)}
                                        className="h-7 text-[11px] px-2.5"
                                      >
                                        Revoke Access
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Select a project to inspect memberships
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="flex-1 bg-bg-app flex flex-col p-6 overflow-y-auto">
            <div className="max-w-6xl w-full mx-auto space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-medium text-text-primary">User Directory</h1>
                  <p className="text-xs text-text-secondary">
                    Administered client, employee, and administrator accounts
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users..."
                      className="pl-9 h-8 text-xs bg-bg-field rounded-full border-none"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateUserOpen(true)}
                    className="gap-1.5 h-8 text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </Button>
                </div>
              </div>

              {/* Users Table */}
              <Card className="bg-bg-surface border-border p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary">
                        <th className="pb-2.5 font-medium">Real Name</th>
                        <th className="pb-2.5 font-medium">Email</th>
                        <th className="pb-2.5 font-medium">Phone</th>
                        <th className="pb-2.5 font-medium">Role</th>
                        <th className="pb-2.5 font-medium">Status</th>
                        <th className="pb-2.5 font-medium">Active Memberships</th>
                        <th className="pb-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center">
                            <Skeleton className="h-8 w-full" />
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-text-secondary">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-bg-hover/50">
                            <td className="py-3 pr-4 font-medium text-text-primary">
                              {u.realName}
                            </td>
                            <td className="py-3 pr-4 text-text-secondary">{u.email}</td>
                            <td className="py-3 pr-4 text-text-secondary">
                              {u.phone || "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge variant="neutral">{u.role}</Badge>
                            </td>
                            <td className="py-3 pr-4">
                              {u.isActive ? (
                                <Badge variant="neutral" className="text-accent bg-accent-soft">
                                  ACTIVE
                                </Badge>
                              ) : (
                                <Badge variant="danger">DEACTIVATED</Badge>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-text-secondary">
                              {u._count?.memberships ?? 0}
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                variant={u.isActive ? "danger" : "secondary"}
                                size="sm"
                                onClick={() => setUserToToggle(u)}
                                className="h-7 text-[11px] px-2.5"
                              >
                                {u.isActive ? "Deactivate" : "Reactivate"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Project */}
      <Modal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        title="Create New Project"
        description="Creates a confidential workspace and its associated conversation."
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Project Title</label>
            <Input
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              placeholder="e.g. Project Gamma"
              required
              className="bg-bg-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Description</label>
            <Input
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="Brief summary of confidential engagement"
              className="bg-bg-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateProjectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingProject}
            >
              {submittingProject ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create User */}
      <Modal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title="Create User Account"
        description="Creates an authenticated identity with hashed credentials."
      >
        <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Real Name</label>
            <Input
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Full Name"
              required
              className="bg-bg-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Email Address</label>
            <Input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="name@company.internal"
              required
              className="bg-bg-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Phone (Optional)</label>
            <Input
              value={newUserPhone}
              onChange={(e) => setNewUserPhone(e.target.value)}
              placeholder="+1..."
              className="bg-bg-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">System Role</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as any)}
              className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none focus:border-text-secondary"
            >
              <option value="CLIENT">Client</option>
              <option value="EMPLOYEE">Employee / Specialist</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Initial Password</label>
            <Input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={8}
              className="bg-bg-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateUserOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingUser}
            >
              {submittingUser ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Member */}
      <Modal
        isOpen={isAssignMemberOpen}
        onClose={() => setIsAssignMemberOpen(false)}
        title="Assign Project Member"
        description="Generates an automatic unique alias for this project."
      >
        <form onSubmit={handleAssignMember} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Select User</label>
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              required
              className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none focus:border-text-secondary"
            >
              <option value="">-- Choose User --</option>
              {users
                .filter((u) => u.isActive && u.role !== "ADMIN")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.realName} ({u.email}) — {u.role}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-text-secondary font-medium">Project Role</label>
            <select
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value as any)}
              className="w-full h-9 rounded bg-bg-field border border-border px-2 text-xs text-text-primary focus:outline-none focus:border-text-secondary"
            >
              <option value="CLIENT">Client</option>
              <option value="EMPLOYEE">Project Specialist</option>
            </select>
          </div>

          <p className="text-[11px] text-text-secondary/70 italic">
            Note: An alias unique to this project (e.g. &quot;Client A&quot; or &quot;Project Specialist B&quot;)
            will be assigned automatically.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAssignMemberOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingAssign || !assignUserId}
            >
              {submittingAssign ? "Assigning..." : "Assign Member"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal: Remove Member */}
      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        title="Revoke Project Access"
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-secondary">
            Are you sure you want to revoke access for{" "}
            <span className="font-semibold text-text-primary">
              {memberToRemove?.alias} ({memberToRemove?.user.realName})
            </span>
            ? Their project access will be terminated immediately.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMemberToRemove(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemoveMember}>
              Revoke Access
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Toggle User Active */}
      <Modal
        isOpen={Boolean(userToToggle)}
        onClose={() => setUserToToggle(null)}
        title={userToToggle?.isActive ? "Deactivate User" : "Reactivate User"}
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-secondary">
            {userToToggle?.isActive
              ? `Are you sure you want to deactivate ${userToToggle?.realName}? All active sessions will be invalidated immediately.`
              : `Reactivate ${userToToggle?.realName}? The user will be able to log in again.`}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setUserToToggle(null)}
            >
              Cancel
            </Button>
            <Button
              variant={userToToggle?.isActive ? "danger" : "primary"}
              size="sm"
              onClick={handleToggleActive}
            >
              {userToToggle?.isActive ? "Deactivate User" : "Reactivate User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

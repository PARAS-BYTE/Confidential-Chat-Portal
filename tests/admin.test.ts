import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole, MembershipStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getUsers, POST as createUser } from "@/app/api/admin/users/route";
import { POST as toggleUserActive } from "@/app/api/admin/users/[id]/toggle-active/route";
import { GET as getProjects, POST as createProject } from "@/app/api/admin/projects/route";
import { POST as assignMember } from "@/app/api/admin/projects/[id]/memberships/route";
import { DELETE as removeMember } from "@/app/api/admin/projects/[id]/memberships/[membershipId]/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";
import { assertProjectAccess } from "@/lib/authz";

const prisma = new PrismaClient();

describe("Feature 5: Admin Management & Role Boundaries", () => {
  let adminUserId: string;
  let adminToken: string;

  let clientUserId: string;
  let clientToken: string;

  let testProjectId: string;

  beforeAll(async () => {
    const passwordHash = await argon2.hash("AdminTest123!");

    // Create Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin-mgmt-${Date.now()}@test.internal`,
        realName: "Admin Test",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    adminUserId = admin.id;
    const adminSession = await createSession(admin.id);
    adminToken = adminSession.token;

    // Create Client
    const client = await prisma.user.create({
      data: {
        email: `client-mgmt-${Date.now()}@test.internal`,
        realName: "Client Test",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    clientUserId = client.id;
    const clientSession = await createSession(client.id);
    clientToken = clientSession.token;
  });

  afterAll(async () => {
    if (testProjectId) {
      await prisma.auditEvent.deleteMany({ where: { targetId: testProjectId } });
      await prisma.readState.deleteMany({ where: { conversation: { projectId: testProjectId } } });
      await prisma.message.deleteMany({ where: { conversation: { projectId: testProjectId } } });
      await prisma.conversation.deleteMany({ where: { projectId: testProjectId } });
      await prisma.membership.deleteMany({ where: { projectId: testProjectId } });
      await prisma.project.deleteMany({ where: { id: testProjectId } });
    }

    await prisma.session.deleteMany({
      where: { userId: { in: [adminUserId, clientUserId] } },
    });
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: [adminUserId, clientUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, clientUserId] } },
    });

    await prisma.$disconnect();
  });

  function makeAuthRequest(
    url: string,
    method: string,
    token: string,
    body?: any
  ): NextRequest {
    const headers: Record<string, string> = {
      cookie: `${SESSION_COOKIE_NAME}=${token}; ${ROLE_COOKIE_NAME}=ADMIN`,
      origin: "http://localhost:3000",
      "content-type": "application/json",
    };
    return new NextRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("blocks non-admin client session with 403 on admin endpoints", async () => {
    // Attempt GET /api/admin/users as CLIENT
    const req = makeAuthRequest("http://localhost:3000/api/admin/users", "GET", clientToken);
    const res = await getUsers(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Insufficient permissions");
  });

  it("allows admin to create a new user and records AuditEvent", async () => {
    const newUserEmail = `new-user-${Date.now()}@test.internal`;
    const req = makeAuthRequest("http://localhost:3000/api/admin/users", "POST", adminToken, {
      realName: "Newly Created User",
      email: newUserEmail,
      role: UserRole.CLIENT,
      password: "SafePassword123!",
    });

    const res = await createUser(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe(newUserEmail);

    // Verify AuditEvent exists
    const audit = await prisma.auditEvent.findFirst({
      where: {
        actorId: adminUserId,
        action: "USER_CREATED",
        targetId: data.user.id,
      },
    });
    expect(audit).not.toBeNull();

    // Cleanup created user
    await prisma.auditEvent.deleteMany({ where: { targetId: data.user.id } });
    await prisma.user.delete({ where: { id: data.user.id } });
  });

  it("allows admin to create a project and automatically creates Conversation", async () => {
    const req = makeAuthRequest("http://localhost:3000/api/admin/projects", "POST", adminToken, {
      title: "Project Gamma Confidential",
      description: "Automated test project",
    });

    const res = await createProject(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.project.title).toBe("Project Gamma Confidential");
    testProjectId = data.project.id;

    // Check conversation automatically created
    const conversation = await prisma.conversation.findUnique({
      where: { projectId: testProjectId },
    });
    expect(conversation).not.toBeNull();

    // Check audit event
    const audit = await prisma.auditEvent.findFirst({
      where: {
        actorId: adminUserId,
        action: "PROJECT_CREATED",
        targetId: testProjectId,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("assigns client to project with an auto-generated unique alias and records audit event", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/projects/${testProjectId}/memberships`,
      "POST",
      adminToken,
      {
        userId: clientUserId,
        role: UserRole.CLIENT,
      }
    );

    const res = await assignMember(req, { params: Promise.resolve({ id: testProjectId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.membership.userId).toBe(clientUserId);
    expect(data.membership.alias).toMatch(/^Client [A-Z0-9]+$/);
    expect(data.membership.status).toBe(MembershipStatus.ACTIVE);

    // User can now access project
    const access = await assertProjectAccess(clientUserId, testProjectId);
    expect(access.id).toBe(data.membership.id);
  });

  it("removing membership revokes access immediately (assertProjectAccess returns 404)", async () => {
    const membership = await prisma.membership.findFirst({
      where: { projectId: testProjectId, userId: clientUserId },
    });
    expect(membership).not.toBeNull();

    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/projects/${testProjectId}/memberships/${membership!.id}`,
      "DELETE",
      adminToken
    );

    const res = await removeMember(req, {
      params: Promise.resolve({ id: testProjectId, membershipId: membership!.id }),
    });
    expect(res.status).toBe(200);

    // Assert that client no longer has project access (throws 404 anti-enumeration)
    await expect(assertProjectAccess(clientUserId, testProjectId)).rejects.toThrow("Resource not found");

    // Verify audit event
    const audit = await prisma.auditEvent.findFirst({
      where: {
        actorId: adminUserId,
        action: "MEMBER_REMOVED",
        targetId: membership!.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("deactivating a user revokes their active sessions immediately", async () => {
    // Create dummy user with active session
    const passwordHash = await argon2.hash("TempPass123!");
    const tempUser = await prisma.user.create({
      data: {
        email: `temp-deact-${Date.now()}@test.internal`,
        realName: "Temp Deactivate",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const tempSession = await createSession(tempUser.id);

    // Verify session exists
    const beforeSession = await prisma.session.findFirst({ where: { userId: tempUser.id } });
    expect(beforeSession).not.toBeNull();

    // Deactivate user via admin endpoint
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/users/${tempUser.id}/toggle-active`,
      "POST",
      adminToken
    );
    const res = await toggleUserActive(req, { params: Promise.resolve({ id: tempUser.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.isActive).toBe(false);

    // Verify session is deleted
    const afterSession = await prisma.session.findFirst({ where: { userId: tempUser.id } });
    expect(afterSession).toBeNull();

    // Cleanup
    await prisma.auditEvent.deleteMany({ where: { targetId: tempUser.id } });
    await prisma.user.delete({ where: { id: tempUser.id } });
  });
});

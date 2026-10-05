import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole, MembershipStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getProjects } from "@/app/api/projects/route";
import { GET as getMessages, POST as sendMessage } from "@/app/api/projects/[projectId]/messages/route";
import { POST as markRead } from "@/app/api/projects/[projectId]/read/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { GET as getFlags } from "@/app/api/admin/flags/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";
import { _resetRateLimits } from "@/lib/auth/rate-limit";

const prisma = new PrismaClient();

// Recursive key scanner to verify zero privacy leaks
function getAllKeys(obj: any): string[] {
  let keys: string[] = [];
  if (!obj || typeof obj !== "object") return keys;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      keys = keys.concat(getAllKeys(item));
    }
  } else {
    for (const [key, value] of Object.entries(obj)) {
      keys.push(key);
      keys = keys.concat(getAllKeys(value));
    }
  }
  return keys;
}

describe("Feature 14: Security Hardening, IDOR & Privacy Invariant Audit", () => {
  let userA: any;
  let tokenA: string;

  let userB: any;
  let tokenB: string;

  let projectA: any;
  let memberA: any;

  let projectB: any;
  let memberB: any;

  beforeAll(async () => {
    _resetRateLimits();
    const passwordHash = await argon2.hash("SecurityAudit123!");

    // User A & Project A
    userA = await prisma.user.create({
      data: {
        email: `sec-user-a-${Date.now()}@audit.test`,
        realName: "User Alice Real",
        phone: "+15550001111",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sA = await createSession(userA.id);
    tokenA = sA.token;

    projectA = await prisma.project.create({
      data: {
        title: "Confidential Project Alpha",
        status: "ACTIVE",
      },
    });

    await prisma.conversation.create({
      data: { projectId: projectA.id },
    });

    memberA = await prisma.membership.create({
      data: {
        userId: userA.id,
        projectId: projectA.id,
        alias: "Alice Persona",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });

    // User B & Project B
    userB = await prisma.user.create({
      data: {
        email: `sec-user-b-${Date.now()}@audit.test`,
        realName: "User Bob Real",
        phone: "+15550002222",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sB = await createSession(userB.id);
    tokenB = sB.token;

    projectB = await prisma.project.create({
      data: {
        title: "Confidential Project Beta",
        status: "ACTIVE",
      },
    });

    await prisma.conversation.create({
      data: { projectId: projectB.id },
    });

    memberB = await prisma.membership.create({
      data: {
        userId: userB.id,
        projectId: projectB.id,
        alias: "Bob Persona",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({
      where: {
        conversation: {
          projectId: { in: [projectA?.id, projectB?.id].filter(Boolean) },
        },
      },
    });
    await prisma.conversation.deleteMany({
      where: { projectId: { in: [projectA?.id, projectB?.id].filter(Boolean) } },
    });
    await prisma.membership.deleteMany({
      where: { projectId: { in: [projectA?.id, projectB?.id].filter(Boolean) } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [projectA?.id, projectB?.id].filter(Boolean) } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userA?.id, userB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });

  function makeRequest(
    url: string,
    token: string,
    role: UserRole,
    method = "GET",
    body?: any,
    origin = "http://localhost:3000"
  ): NextRequest {
    const req = new NextRequest(new URL(url, "http://localhost:3000"), {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    req.cookies.set(SESSION_COOKIE_NAME, token);
    req.cookies.set(ROLE_COOKIE_NAME, role);
    return req;
  }

  it("1. IDOR: User A cannot read User B's project messages (returns 404 anti-enumeration)", async () => {
    const req = makeRequest(
      `http://localhost:3000/api/projects/${projectB.id}/messages`,
      tokenA,
      UserRole.CLIENT
    );
    const res = await getMessages(req, { params: Promise.resolve({ projectId: projectB.id }) });
    expect(res.status).toBe(404);
  });

  it("2. IDOR: User A cannot send a message to User B's project (returns 404 anti-enumeration)", async () => {
    const req = makeRequest(
      `http://localhost:3000/api/projects/${projectB.id}/messages`,
      tokenA,
      UserRole.CLIENT,
      "POST",
      { body: "Sneaky injection attempt", clientMessageId: "inj_1" }
    );
    const res = await sendMessage(req, { params: Promise.resolve({ projectId: projectB.id }) });
    expect(res.status).toBe(404);
  });

  it("3. IDOR: User A cannot mark User B's conversation read (returns 404 anti-enumeration)", async () => {
    const req = makeRequest(
      `http://localhost:3000/api/projects/${projectB.id}/read`,
      tokenA,
      UserRole.CLIENT,
      "POST"
    );
    const res = await markRead(req, { params: Promise.resolve({ projectId: projectB.id }) });
    expect(res.status).toBe(404);
  });

  it("4. Non-admin participant cannot call administrative flag review (returns 403)", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/admin/flags",
      tokenA,
      UserRole.CLIENT
    );
    const res = await getFlags(req);
    expect(res.status).toBe(403);
  });

  it("5. Removed membership loses access immediately (REST returns 404)", async () => {
    // Demote User A to REMOVED in Project A
    await prisma.membership.update({
      where: { id: memberA.id },
      data: { status: MembershipStatus.REMOVED },
    });

    const req = makeRequest(
      `http://localhost:3000/api/projects/${projectA.id}/messages`,
      tokenA,
      UserRole.CLIENT
    );
    const res = await getMessages(req, { params: Promise.resolve({ projectId: projectA.id }) });
    expect(res.status).toBe(404);

    // Restore for subsequent tests
    await prisma.membership.update({
      where: { id: memberA.id },
      data: { status: MembershipStatus.ACTIVE },
    });
  });

  it("6. Recursive key scan on participant endpoints verifies ZERO forbidden keys leaked", async () => {
    // Send a message first
    const sendReq = makeRequest(
      `http://localhost:3000/api/projects/${projectA.id}/messages`,
      tokenA,
      UserRole.CLIENT,
      "POST",
      { body: "Hello Project A", clientMessageId: `msg_${Date.now()}` }
    );
    await sendMessage(sendReq, { params: Promise.resolve({ projectId: projectA.id }) });

    // 1. GET /api/projects
    const projReq = makeRequest("http://localhost:3000/api/projects", tokenA, UserRole.CLIENT);
    const projRes = await getProjects(projReq);
    const projData = await projRes.json();

    // 2. GET /api/projects/[id]/messages
    const msgReq = makeRequest(`http://localhost:3000/api/projects/${projectA.id}/messages`, tokenA, UserRole.CLIENT);
    const msgRes = await getMessages(msgReq, { params: Promise.resolve({ projectId: projectA.id }) });
    const msgData = await msgRes.json();

    // 3. GET /api/notifications
    const notifReq = makeRequest("http://localhost:3000/api/notifications", tokenA, UserRole.CLIENT);
    const notifRes = await getNotifications(notifReq);
    const notifData = await notifRes.json();

    const allParticipantKeys = [
      ...getAllKeys(projData),
      ...getAllKeys(msgData),
      ...getAllKeys(notifData),
    ];

    const strictlyForbiddenKeys = [
      "realName",
      "email",
      "phone",
      "userId",
      "senderMembershipId",
      "recipientUserId",
      "recipientMembershipId",
      "passwordHash",
      "password",
      "tokenHash",
      "users",
      "members",
      "memberships",
    ];

    for (const forbidden of strictlyForbiddenKeys) {
      expect(
        allParticipantKeys,
        `Participant payload leaked forbidden key: ${forbidden}`
      ).not.toContain(forbidden);
    }
  });

  it("7. CSRF / origin validation rejects mutating requests with invalid origin", async () => {
    const maliciousReq = makeRequest(
      `http://localhost:3000/api/projects/${projectA.id}/messages`,
      tokenA,
      UserRole.CLIENT,
      "POST",
      { body: "Forged message", clientMessageId: "forged_1" },
      "https://attacker-domain.evil.com"
    );
    const res = await sendMessage(maliciousReq, { params: Promise.resolve({ projectId: projectA.id }) });
    expect(res.status).toBe(403);
  });
});

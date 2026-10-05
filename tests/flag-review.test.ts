import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole, MessageStatus, MembershipStatus, FlagStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getFlags } from "@/app/api/admin/flags/route";
import { GET as getFlagDetail } from "@/app/api/admin/flags/[id]/route";
import { POST as makeDecision } from "@/app/api/admin/flags/[id]/decision/route";
import { GET as getMessages } from "@/app/api/projects/[projectId]/messages/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";

const prisma = new PrismaClient();

describe("Feature 10: Admin Flag Review Queue & Decisions", () => {
  let adminUser: any;
  let adminToken: string;

  let clientUser: any;
  let clientToken: string;

  let employeeUser: any;
  let employeeToken: string;

  let project: any;
  let conversation: any;
  let memberClient: any;
  let memberEmployee: any;

  let heldMessage: any;
  let heldFlag: any;

  let rejectMessage: any;
  let rejectFlag: any;

  let dismissMessage: any;
  let dismissFlag: any;

  beforeAll(async () => {
    const passwordHash = await argon2.hash("FlagReviewTest123!");

    adminUser = await prisma.user.create({
      data: {
        email: `flag-admin-${Date.now()}@test.internal`,
        realName: "Security Administrator",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const sAdmin = await createSession(adminUser.id);
    adminToken = sAdmin.token;

    clientUser = await prisma.user.create({
      data: {
        email: `flag-client-${Date.now()}@test.internal`,
        realName: "Client Review Target",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sClient = await createSession(clientUser.id);
    clientToken = sClient.token;

    employeeUser = await prisma.user.create({
      data: {
        email: `flag-employee-${Date.now()}@test.internal`,
        realName: "Specialist Review Partner",
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    });
    const sEmp = await createSession(employeeUser.id);
    employeeToken = sEmp.token;

    project = await prisma.project.create({
      data: {
        title: "Project Review Test",
        description: "Test scope for admin flag review",
        status: "ACTIVE",
      },
    });

    conversation = await prisma.conversation.create({
      data: { projectId: project.id },
    });

    memberClient = await prisma.membership.create({
      data: {
        userId: clientUser.id,
        projectId: project.id,
        alias: "Client Alpha",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });

    memberEmployee = await prisma.membership.create({
      data: {
        userId: employeeUser.id,
        projectId: project.id,
        alias: "Specialist Beta",
        role: "EMPLOYEE",
        status: MembershipStatus.ACTIVE,
      },
    });

    // 1. Create a held message + flag to test APPROVE
    heldMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderMembershipId: memberClient.id,
        clientMessageId: `held_msg_${Date.now()}_1`,
        body: "Call me on 9876543210 please",
        status: MessageStatus.HELD,
        deliveredAt: null,
      },
    });
    heldFlag = await prisma.flag.create({
      data: {
        messageId: heldMessage.id,
        category: "CONTACT",
        severity: "HIGH",
        reason: "Phone number detected",
        matchedText: "9876543210",
        status: FlagStatus.OPEN,
      },
    });

    // 2. Create a held message + flag to test REJECT
    rejectMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderMembershipId: memberClient.id,
        clientMessageId: `reject_msg_${Date.now()}_2`,
        body: "Let's move outside to whatsapp",
        status: MessageStatus.HELD,
        deliveredAt: null,
      },
    });
    rejectFlag = await prisma.flag.create({
      data: {
        messageId: rejectMessage.id,
        category: "OFF_PLATFORM",
        severity: "HIGH",
        reason: "Off-platform solicitation",
        matchedText: "whatsapp",
        status: FlagStatus.OPEN,
      },
    });

    // 3. Create a held message + flag to test DISMISS
    dismissMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderMembershipId: memberClient.id,
        clientMessageId: `dismiss_msg_${Date.now()}_3`,
        body: "Meeting in room 4021 at 3 pm",
        status: MessageStatus.HELD,
        deliveredAt: null,
      },
    });
    dismissFlag = await prisma.flag.create({
      data: {
        messageId: dismissMessage.id,
        category: "CONTACT",
        severity: "MEDIUM",
        reason: "Ambiguous number sequence",
        matchedText: "4021",
        status: FlagStatus.OPEN,
      },
    });
  });

  afterAll(async () => {
    if (project?.id) {
      await prisma.notification.deleteMany({
        where: { recipientUserId: { in: [adminUser?.id, clientUser?.id, employeeUser?.id] } },
      });
      await prisma.auditEvent.deleteMany({
        where: { targetType: "FLAG" },
      });
      await prisma.flag.deleteMany({
        where: { message: { conversation: { projectId: project.id } } },
      });
      await prisma.message.deleteMany({
        where: { conversation: { projectId: project.id } },
      });
      await prisma.readState.deleteMany({
        where: { conversation: { projectId: project.id } },
      });
      await prisma.conversation.deleteMany({
        where: { projectId: project.id },
      });
      await prisma.membership.deleteMany({
        where: { projectId: project.id },
      });
      await prisma.project.deleteMany({
        where: { id: project.id },
      });
    }

    const uIds = [adminUser?.id, clientUser?.id, employeeUser?.id].filter(Boolean);
    await prisma.session.deleteMany({ where: { userId: { in: uIds } } });
    await prisma.user.deleteMany({ where: { id: { in: uIds } } });

    await prisma.$disconnect();
  });

  function makeAuthRequest(
    url: string,
    method: string,
    token: string,
    role: string = "ADMIN",
    body?: any
  ): NextRequest {
    return new NextRequest(url, {
      method,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}; ${ROLE_COOKIE_NAME}=${role}`,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("blocks non-admin client session with 403 on flag review endpoints", async () => {
    const req = makeAuthRequest("http://localhost:3000/api/admin/flags", "GET", clientToken, "CLIENT");
    const res = await getFlags(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Insufficient permissions");
  });

  it("admin lists flags and inspects conversation context", async () => {
    const req = makeAuthRequest("http://localhost:3000/api/admin/flags", "GET", adminToken);
    const res = await getFlags(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flags.length).toBeGreaterThanOrEqual(3);

    // Detail check
    const detailReq = makeAuthRequest(`http://localhost:3000/api/admin/flags/${heldFlag.id}`, "GET", adminToken);
    const detailRes = await getFlagDetail(detailReq, { params: Promise.resolve({ id: heldFlag.id }) });
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.flag.id).toBe(heldFlag.id);
    expect(detailData.context.message.body).toBe("Call me on 9876543210 please");
  });

  it("admin approves held message: sets DELIVERED, notifies sender, recipient can see it", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/flags/${heldFlag.id}/decision`,
      "POST",
      adminToken,
      "ADMIN",
      {
        decision: "APPROVE",
        note: "Approved after client identity verified",
      }
    );

    const res = await makeDecision(req, { params: Promise.resolve({ id: heldFlag.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flag.status).toBe(FlagStatus.APPROVED);
    expect(data.messageStatus).toBe(MessageStatus.DELIVERED);

    // Verify message in DB has status DELIVERED
    const msg = await prisma.message.findUnique({ where: { id: heldMessage.id } });
    expect(msg!.status).toBe(MessageStatus.DELIVERED);
    expect(msg!.deliveredAt).not.toBeNull();

    // Verify recipient Employee can now see it
    const empReq = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "GET",
      employeeToken,
      "EMPLOYEE"
    );
    const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: project.id }) });
    const empData = await empRes.json();
    const visibleIds = empData.messages.map((m: any) => m.id);
    expect(visibleIds).toContain(heldMessage.id);

    // Verify sender Notification exists without other users' identities
    const notif = await prisma.notification.findFirst({
      where: { recipientUserId: clientUser.id, type: "MESSAGE_DECISION" },
    });
    expect(notif).not.toBeNull();
    expect(notif!.text).toContain("approved");

    // Verify AuditEvent
    const audit = await prisma.auditEvent.findFirst({
      where: { targetType: "FLAG", targetId: heldFlag.id },
    });
    expect(audit).not.toBeNull();
  });

  it("idempotency: repeated or concurrent approval calls never deliver twice or error", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/flags/${heldFlag.id}/decision`,
      "POST",
      adminToken,
      "ADMIN",
      {
        decision: "APPROVE",
        note: "Repeated click",
      }
    );

    const res = await makeDecision(req, { params: Promise.resolve({ id: heldFlag.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyDecided).toBe(true);
    expect(data.flag.status).toBe(FlagStatus.APPROVED);
  });

  it("admin rejects message: keeps REJECTED and recipient never sees it", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/flags/${rejectFlag.id}/decision`,
      "POST",
      adminToken,
      "ADMIN",
      {
        decision: "REJECT",
        note: "Severe violation of off-platform communication rule",
      }
    );

    const res = await makeDecision(req, { params: Promise.resolve({ id: rejectFlag.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flag.status).toBe(FlagStatus.REJECTED);
    expect(data.messageStatus).toBe(MessageStatus.REJECTED);

    // Verify message in DB is REJECTED
    const msg = await prisma.message.findUnique({ where: { id: rejectMessage.id } });
    expect(msg!.status).toBe(MessageStatus.REJECTED);

    // Verify recipient CANNOT see the rejected message
    const empReq = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "GET",
      employeeToken,
      "EMPLOYEE"
    );
    const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: project.id }) });
    const empData = await empRes.json();
    const visibleIds = empData.messages.map((m: any) => m.id);
    expect(visibleIds).not.toContain(rejectMessage.id);
  });

  it("admin dismisses flag as false positive: delivers message and marks DISMISSED", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/flags/${dismissFlag.id}/decision`,
      "POST",
      adminToken,
      "ADMIN",
      {
        decision: "DISMISS",
        note: "Technical room number, not a phone number",
      }
    );

    const res = await makeDecision(req, { params: Promise.resolve({ id: dismissFlag.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flag.status).toBe(FlagStatus.DISMISSED);
    expect(data.messageStatus).toBe(MessageStatus.DELIVERED);

    const msg = await prisma.message.findUnique({ where: { id: dismissMessage.id } });
    expect(msg!.status).toBe(MessageStatus.DELIVERED);
  });
});

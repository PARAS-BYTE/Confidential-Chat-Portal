import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole, MessageStatus, MembershipStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { POST as sendMessage, GET as getMessages } from "@/app/api/projects/[projectId]/messages/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";

const prisma = new PrismaClient();

describe("Feature 9: Server-side Moderation, Hold Logic & Flag Creation", () => {
  let adminUser: any;
  let clientUser: any;
  let clientToken: string;

  let employeeUser: any;
  let employeeToken: string;

  let project: any;
  let conversation: any;
  let memberClient: any;
  let memberEmployee: any;

  beforeAll(async () => {
    const passwordHash = await argon2.hash("HoldLogicTest123!");

    adminUser = await prisma.user.create({
      data: {
        email: `hold-admin-${Date.now()}@test.internal`,
        realName: "Moderation Admin",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    clientUser = await prisma.user.create({
      data: {
        email: `hold-client-${Date.now()}@test.internal`,
        realName: "Moderation Client",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sClient = await createSession(clientUser.id);
    clientToken = sClient.token;

    employeeUser = await prisma.user.create({
      data: {
        email: `hold-employee-${Date.now()}@test.internal`,
        realName: "Moderation Specialist",
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    });
    const sEmp = await createSession(employeeUser.id);
    employeeToken = sEmp.token;

    project = await prisma.project.create({
      data: {
        title: "Project Moderation Test",
        description: "Test environment for hold logic",
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
  });

  afterAll(async () => {
    if (project?.id) {
      await prisma.notification.deleteMany({
        where: { recipientUserId: adminUser.id },
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
    body?: any
  ): NextRequest {
    return new NextRequest(url, {
      method,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}; ${ROLE_COOKIE_NAME}=CLIENT`,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("holds phone number sharing and keeps it completely invisible to recipient", async () => {
    const clientMessageId = `hold_phone_${Date.now()}`;
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "POST",
      client1Token(),
      {
        body: "Call me directly on 9876543210 immediately",
        clientMessageId,
      }
    );

    function client1Token() {
      return clientToken;
    }

    const res = await sendMessage(req, { params: Promise.resolve({ projectId: project.id }) });
    expect(res.status).toBe(201);
    const data = await res.json();

    // Sender sees status: HELD
    expect(data.message.status).toBe(MessageStatus.HELD);
    expect(data.message.deliveredAt).toBeNull();

    // Verify Flag was created in DB
    const flag = await prisma.flag.findFirst({
      where: { messageId: data.message.id },
    });
    expect(flag).not.toBeNull();
    expect(flag!.status).toBe("OPEN");
    expect(flag!.category).toBe("CONTACT");

    // Verify Admin Alert Notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        recipientUserId: adminUser.id,
        type: "FLAG_HELD",
      },
    });
    expect(notification).not.toBeNull();

    // CRITICAL: Recipient (Employee) MUST NOT see the held message
    const empReq = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "GET",
      employeeToken
    );
    const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: project.id }) });
    const empData = await empRes.json();
    const recipientVisibleIds = empData.messages.map((m: any) => m.id);
    expect(recipientVisibleIds).not.toContain(data.message.id);
  });

  it("delivers commercial pricing message with an admin alert (ALLOW_FLAG)", async () => {
    const clientMessageId = `comm_price_${Date.now()}`;
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "POST",
      clientToken,
      {
        body: "Can you provide the price quote and advance payment details for this sprint?",
        clientMessageId,
      }
    );

    const res = await sendMessage(req, { params: Promise.resolve({ projectId: project.id }) });
    expect(res.status).toBe(201);
    const data = await res.json();

    // Status is DELIVERED because COMMERCIAL defaults to ALLOW_FLAG
    expect(data.message.status).toBe(MessageStatus.DELIVERED);
    expect(data.message.deliveredAt).not.toBeNull();

    // Flag is created
    const flag = await prisma.flag.findFirst({
      where: { messageId: data.message.id },
    });
    expect(flag).not.toBeNull();
    expect(flag!.category).toBe("COMMERCIAL");

    // Admin Alert is created
    const notification = await prisma.notification.findFirst({
      where: {
        recipientUserId: adminUser.id,
        type: "FLAG_ALERT",
      },
    });
    expect(notification).not.toBeNull();

    // Recipient can see delivered commercial message
    const empReq = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "GET",
      employeeToken
    );
    const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: project.id }) });
    const empData = await empRes.json();
    const deliveredIds = empData.messages.map((m: any) => m.id);
    expect(deliveredIds).toContain(data.message.id);
  });

  it("delivers ordinary message without flags or admin alerts", async () => {
    const clientMessageId = `clean_msg_${Date.now()}`;
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      "POST",
      clientToken,
      {
        body: "Good morning! The new wireframe layout has been submitted for review.",
        clientMessageId,
      }
    );

    const res = await sendMessage(req, { params: Promise.resolve({ projectId: project.id }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message.status).toBe(MessageStatus.DELIVERED);

    // No flags for this message
    const flag = await prisma.flag.findFirst({
      where: { messageId: data.message.id },
    });
    expect(flag).toBeNull();
  });
});

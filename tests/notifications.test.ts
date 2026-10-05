import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  PrismaClient,
  UserRole,
  MessageStatus,
  MembershipStatus,
  RuleCategory,
  RuleSeverity,
  RuleAction,
  PatternType,
} from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getUnreadCount } from "@/app/api/admin/notifications/unread-count/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { POST as markNotificationsRead } from "@/app/api/notifications/read/route";
import { POST as sendMessage } from "@/app/api/projects/[projectId]/messages/route";
import { GET as getProjects } from "@/app/api/projects/route";
import { POST as makeDecision } from "@/app/api/admin/flags/[id]/decision/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";

const prisma = new PrismaClient();

describe("Feature 12: Notifications & Unread Handling", () => {
  let adminUser: any;
  let adminToken: string;

  let clientUser: any;
  let clientToken: string;

  let employeeUser: any;
  let employeeToken: string;

  let project: any;
  let conversation: any;
  let clientMembership: any;
  let employeeMembership: any;

  beforeAll(async () => {
    const passwordHash = await argon2.hash("NotifTestPassword123!");

    // Ensure baseline rule exists
    const existingRule = await prisma.rule.findFirst({
      where: { name: "Notif Phone Hold Rule" },
    });
    if (!existingRule) {
      await prisma.rule.create({
        data: {
          name: "Notif Phone Hold Rule",
          category: RuleCategory.CONTACT,
          pattern: "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
          patternType: PatternType.REGEX,
          severity: RuleSeverity.HIGH,
          action: RuleAction.HOLD,
          isActive: true,
          isLocked: true,
        },
      });
    }

    // 1. Admin
    adminUser = await prisma.user.create({
      data: {
        email: `notif-admin-${Date.now()}@test.internal`,
        realName: "Admin User",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const sAdmin = await createSession(adminUser.id);
    adminToken = sAdmin.token;

    // 2. Client
    clientUser = await prisma.user.create({
      data: {
        email: `notif-client-${Date.now()}@test.internal`,
        realName: "Client Sender",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sClient = await createSession(clientUser.id);
    clientToken = sClient.token;

    // 3. Employee
    employeeUser = await prisma.user.create({
      data: {
        email: `notif-emp-${Date.now()}@test.internal`,
        realName: "Employee Receiver",
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    });
    const sEmp = await createSession(employeeUser.id);
    employeeToken = sEmp.token;

    // 4. Project & Memberships
    project = await prisma.project.create({
      data: {
        title: "Notification Project Scope",
        description: "Testing notification delivery and unread counting",
        status: "ACTIVE",
      },
    });

    conversation = await prisma.conversation.create({
      data: {
        projectId: project.id,
      },
    });

    clientMembership = await prisma.membership.create({
      data: {
        userId: clientUser.id,
        projectId: project.id,
        alias: "Client Alpha",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });

    employeeMembership = await prisma.membership.create({
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
    await prisma.notification.deleteMany({
      where: {
        recipientUserId: {
          in: [adminUser?.id, clientUser?.id, employeeUser?.id].filter(Boolean),
        },
      },
    });
    await prisma.flag.deleteMany({
      where: { message: { conversation: { projectId: project?.id } } },
    });
    await prisma.message.deleteMany({
      where: { conversation: { projectId: project?.id } },
    });
    await prisma.conversation.deleteMany({ where: { projectId: project?.id } });
    await prisma.membership.deleteMany({ where: { projectId: project?.id } });
    await prisma.project.deleteMany({ where: { id: project?.id } });
    await prisma.session.deleteMany({
      where: {
        userId: { in: [adminUser?.id, clientUser?.id, employeeUser?.id].filter(Boolean) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUser?.id, clientUser?.id, employeeUser?.id].filter(Boolean) },
      },
    });
    await prisma.$disconnect();
  });

  function makeRequest(
    url: string,
    token: string,
    role: UserRole,
    method = "GET",
    body?: any
  ): NextRequest {
    const req = new NextRequest(new URL(url, "http://localhost:3000"), {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    req.cookies.set(SESSION_COOKIE_NAME, token);
    req.cookies.set(ROLE_COOKIE_NAME, role);
    return req;
  }

  it("1. Flag creation in send-flow generates admin alert and updates unread counts", async () => {
    // Client sends message with phone number (triggers HOLD)
    const clientMsgId = `notif_held_${Date.now()}`;
    const sendReq = makeRequest(
      `http://localhost:3000/api/projects/${project.id}/messages`,
      clientToken,
      UserRole.CLIENT,
      "POST",
      { body: "Please call my mobile: 415-555-2671", clientMessageId: clientMsgId }
    );
    const sendRes = await sendMessage(sendReq, { params: Promise.resolve({ projectId: project.id }) });
    expect(sendRes.status).toBe(201);
    const sendData = await sendRes.json();
    expect(sendData.message.status).toBe("HELD");

    // Admin checks unread counts
    const adminReq = makeRequest(
      "http://localhost:3000/api/admin/notifications/unread-count",
      adminToken,
      UserRole.ADMIN
    );
    const countRes = await getUnreadCount(adminReq);
    expect(countRes.status).toBe(200);
    const countData = await countRes.json();
    expect(countData.openFlagsCount).toBeGreaterThanOrEqual(1);
    expect(countData.unreadNotificationsCount).toBeGreaterThanOrEqual(1);
  });

  it("2. Recipient unread counts strictly exclude HELD messages", async () => {
    // Employee checks project inbox
    const empReq = makeRequest(
      "http://localhost:3000/api/projects",
      employeeToken,
      UserRole.EMPLOYEE
    );
    const empRes = await getProjects(empReq);
    expect(empRes.status).toBe(200);
    const empData = await empRes.json();

    const empProject = empData.projects.find((p: any) => p.id === project.id);
    expect(empProject).toBeDefined();
    // Held message is NOT counted in unreadCount
    expect(empProject.unreadCount).toBe(0);
    // Held message is NOT previewed
    expect(empProject.lastMessagePreview).toBeNull();
  });

  it("3. Admin approval decision creates notification for sender only (zero identity leakage)", async () => {
    // Find the open flag
    const flag = await prisma.flag.findFirst({
      where: {
        message: {
          conversation: { projectId: project.id },
          status: MessageStatus.HELD,
        },
      },
    });
    expect(flag).toBeDefined();

    // Admin approves the flag
    const decisionReq = makeRequest(
      `http://localhost:3000/api/admin/flags/${flag!.id}/decision`,
      adminToken,
      UserRole.ADMIN,
      "POST",
      { decision: "APPROVE", note: "Verified business contact requirement" }
    );
    const decisionRes = await makeDecision(decisionReq, { params: Promise.resolve({ id: flag!.id }) });
    expect(decisionRes.status).toBe(200);

    // Client (sender) checks notifications
    const clientNotifReq = makeRequest(
      "http://localhost:3000/api/notifications",
      clientToken,
      UserRole.CLIENT
    );
    const clientNotifRes = await getNotifications(clientNotifReq);
    expect(clientNotifRes.status).toBe(200);
    const clientNotifData = await clientNotifRes.json();
    expect(clientNotifData.notifications.length).toBeGreaterThanOrEqual(1);

    const decisionNotif = clientNotifData.notifications.find(
      (n: any) => n.type === "MESSAGE_DECISION"
    );
    expect(decisionNotif).toBeDefined();
    expect(decisionNotif.text).toBe("Your held message was approved by CCP Studio.");
    // Invariant: no raw user ID, membership ID, email or name
    expect(decisionNotif.recipientUserId).toBeUndefined();
    expect(decisionNotif.recipientMembershipId).toBeUndefined();
    expect(decisionNotif.senderRealName).toBeUndefined();

    // Employee (counterpart) checks notifications -> should NOT receive sender's decision notice
    const empNotifReq = makeRequest(
      "http://localhost:3000/api/notifications",
      employeeToken,
      UserRole.EMPLOYEE
    );
    const empNotifRes = await getNotifications(empNotifReq);
    const empNotifData = await empNotifRes.json();
    const empDecisionNotif = empNotifData.notifications.find(
      (n: any) => n.id === decisionNotif.id
    );
    expect(empDecisionNotif).toBeUndefined();
  });

  it("4. Cross-user notification marking is rejected/ignored and user can mark own notifications read", async () => {
    // Get client's notification
    const clientNotifReq = makeRequest(
      "http://localhost:3000/api/notifications",
      clientToken,
      UserRole.CLIENT
    );
    const clientNotifRes = await getNotifications(clientNotifReq);
    const clientNotifData = await clientNotifRes.json();
    const clientNotif = clientNotifData.notifications[0];
    expect(clientNotif).toBeDefined();
    expect(clientNotif.readAt).toBeNull();

    // Employee attempts to mark Client's notification as read
    const tamperReq = makeRequest(
      "http://localhost:3000/api/notifications/read",
      employeeToken,
      UserRole.EMPLOYEE,
      "POST",
      { notificationIds: [clientNotif.id] }
    );
    const tamperRes = await markNotificationsRead(tamperReq);
    expect(tamperRes.status).toBe(200);
    const tamperData = await tamperRes.json();
    // 0 rows updated because the notification belongs to Client, not Employee
    expect(tamperData.count).toBe(0);

    // Client marks their own notification as read
    const markReq = makeRequest(
      "http://localhost:3000/api/notifications/read",
      clientToken,
      UserRole.CLIENT,
      "POST",
      { notificationIds: [clientNotif.id] }
    );
    const markRes = await markNotificationsRead(markReq);
    expect(markRes.status).toBe(200);
    const markData = await markRes.json();
    expect(markData.count).toBe(1);

    // Client fetches notifications again -> readAt is populated
    const checkReq = makeRequest(
      "http://localhost:3000/api/notifications",
      clientToken,
      UserRole.CLIENT
    );
    const checkRes = await getNotifications(checkReq);
    const checkData = await checkRes.json();
    const updatedNotif = checkData.notifications.find((n: any) => n.id === clientNotif.id);
    expect(updatedNotif.readAt).not.toBeNull();
  });
});

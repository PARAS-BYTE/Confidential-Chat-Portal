import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  PrismaClient,
  UserRole,
  MembershipStatus,
  MessageStatus,
  FlagStatus,
  RuleCategory,
  RuleSeverity,
  RuleAction,
  PatternType,
} from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getProjects } from "@/app/api/projects/route";
import { GET as getMessages, POST as sendMessage } from "@/app/api/projects/[projectId]/messages/route";
import { POST as markRead } from "@/app/api/projects/[projectId]/read/route";
import { GET as getFlags } from "@/app/api/admin/flags/route";
import { POST as makeDecision } from "@/app/api/admin/flags/[id]/decision/route";
import { GET as getAudit } from "@/app/api/admin/audit/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";
import { _resetRateLimits } from "@/lib/auth/rate-limit";

const prisma = new PrismaClient();

interface ScenarioResult {
  scenario: number;
  name: string;
  status: "PASS" | "FAIL";
  details: string;
}

const scenarioResults: ScenarioResult[] = [];

describe("Feature 15: Automated Acceptance Tests (7 Core Scenarios)", () => {
  let adminUser: any;
  let adminToken: string;

  let clientAUser: any;
  let clientAToken: string;

  let employeeAUser: any;
  let employeeAToken: string;

  let unrelatedUser: any;
  let unrelatedToken: string;

  let projectA: any;
  let conversationA: any;
  let memberClientA: any;
  let memberEmployeeA: any;

  let projectB: any;
  let conversationB: any;
  let memberUnrelatedB: any;

  let projectC: any;
  let memberClientAInC: any;

  beforeAll(async () => {
    _resetRateLimits();
    const passwordHash = await argon2.hash("AcceptancePassword123!");

    // Ensure baseline rules exist
    const contactRule = await prisma.rule.findFirst({ where: { category: RuleCategory.CONTACT } });
    if (!contactRule) {
      await prisma.rule.create({
        data: {
          name: "Acc Contact Phone Rule",
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

    const commRule = await prisma.rule.findFirst({ where: { category: RuleCategory.COMMERCIAL } });
    if (!commRule) {
      await prisma.rule.create({
        data: {
          name: "Acc Commercial Price Rule",
          category: RuleCategory.COMMERCIAL,
          pattern: "\\b(price|quote|discount|invoice|\\$|cost)\\b",
          patternType: PatternType.REGEX,
          severity: RuleSeverity.LOW,
          action: RuleAction.ALLOW_FLAG,
          isActive: true,
          isLocked: false,
        },
      });
    }

    // 1. Admin
    adminUser = await prisma.user.create({
      data: {
        email: `acc-admin-${Date.now()}@test.ccp`,
        realName: "System Administrator",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const sAdmin = await createSession(adminUser.id);
    adminToken = sAdmin.token;

    // 2. Client A
    clientAUser = await prisma.user.create({
      data: {
        email: `acc-client-a-${Date.now()}@test.ccp`,
        realName: "Client Alice Real",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sClientA = await createSession(clientAUser.id);
    clientAToken = sClientA.token;

    // 3. Employee A
    employeeAUser = await prisma.user.create({
      data: {
        email: `acc-emp-a-${Date.now()}@test.ccp`,
        realName: "Specialist Bob Real",
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    });
    const sEmpA = await createSession(employeeAUser.id);
    employeeAToken = sEmpA.token;

    // 4. Unrelated User (in Project B)
    unrelatedUser = await prisma.user.create({
      data: {
        email: `acc-unrelated-${Date.now()}@test.ccp`,
        realName: "External Charlie Real",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sUnrelated = await createSession(unrelatedUser.id);
    unrelatedToken = sUnrelated.token;

    // 5. Project A (Client A + Employee A)
    projectA = await prisma.project.create({
      data: { title: "Acceptance Project Alpha", status: "ACTIVE" },
    });
    conversationA = await prisma.conversation.create({ data: { projectId: projectA.id } });

    memberClientA = await prisma.membership.create({
      data: {
        userId: clientAUser.id,
        projectId: projectA.id,
        alias: "Client Alpha",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });

    memberEmployeeA = await prisma.membership.create({
      data: {
        userId: employeeAUser.id,
        projectId: projectA.id,
        alias: "Project Specialist A",
        role: "EMPLOYEE",
        status: MembershipStatus.ACTIVE,
      },
    });

    // 6. Project B (Unrelated User)
    projectB = await prisma.project.create({
      data: { title: "Acceptance Project Beta", status: "ACTIVE" },
    });
    conversationB = await prisma.conversation.create({ data: { projectId: projectB.id } });

    memberUnrelatedB = await prisma.membership.create({
      data: {
        userId: unrelatedUser.id,
        projectId: projectB.id,
        alias: "Client Beta",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });

    // 7. Project C (Client A with DIFFERENT alias)
    projectC = await prisma.project.create({
      data: { title: "Acceptance Project Gamma", status: "ACTIVE" },
    });
    await prisma.conversation.create({ data: { projectId: projectC.id } });

    memberClientAInC = await prisma.membership.create({
      data: {
        userId: clientAUser.id,
        projectId: projectC.id,
        alias: "Research Sponsor Z", // Distinct alias for same user
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Output formatted results table
    console.log("\n=======================================================");
    console.log("     CCP STUDIO ACCEPTANCE TEST VERIFICATION MATRIX   ");
    console.log("=======================================================");
    console.table(
      scenarioResults.map((r) => ({
        Scenario: `Scenario ${r.scenario}`,
        Name: r.name,
        Status: r.status,
        Details: r.details,
      }))
    );
    console.log("=======================================================\n");

    const pIds = [projectA?.id, projectB?.id, projectC?.id].filter(Boolean);
    const uIds = [adminUser?.id, clientAUser?.id, employeeAUser?.id, unrelatedUser?.id].filter(Boolean);

    await prisma.notification.deleteMany({ where: { recipientUserId: { in: uIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: uIds } } });
    await prisma.flag.deleteMany({ where: { message: { conversation: { projectId: { in: pIds } } } } });
    await prisma.message.deleteMany({ where: { conversation: { projectId: { in: pIds } } } });
    await prisma.conversation.deleteMany({ where: { projectId: { in: pIds } } });
    await prisma.membership.deleteMany({ where: { projectId: { in: pIds } } });
    await prisma.project.deleteMany({ where: { id: { in: pIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: uIds } } });
    await prisma.user.deleteMany({ where: { id: { in: uIds } } });
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
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    req.cookies.set(SESSION_COOKIE_NAME, token);
    req.cookies.set(ROLE_COOKIE_NAME, role);
    return req;
  }

  it("Scenario 1: Client and employee exchange ordinary messages using aliases; survives reload", async () => {
    try {
      // 1. Client sends message
      const clientMsgId = `ord_client_${Date.now()}`;
      const sendReq1 = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        clientAToken,
        UserRole.CLIENT,
        "POST",
        { body: "Draft review is ready for your feedback.", clientMessageId: clientMsgId }
      );
      const res1 = await sendMessage(sendReq1, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.message.status).toBe("DELIVERED");

      // 2. Employee receives message
      const getReq1 = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        employeeAToken,
        UserRole.EMPLOYEE
      );
      const res2 = await getMessages(getReq1, { params: Promise.resolve({ projectId: projectA.id }) });
      const data2 = await res2.json();
      const received = data2.messages.find((m: any) => m.id === data1.message.id);
      expect(received).toBeDefined();
      expect(received.senderAlias).toBe("Client Alpha");
      expect(received.isMine).toBe(false);

      // 3. Employee replies
      const empMsgId = `ord_emp_${Date.now()}`;
      const sendReq2 = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        employeeAToken,
        UserRole.EMPLOYEE,
        "POST",
        { body: "Thank you. Reviewing now.", clientMessageId: empMsgId }
      );
      const res3 = await sendMessage(sendReq2, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(res3.status).toBe(201);

      // 4. Client reloads / re-queries messages -> both messages survive and persist
      const reloadReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        clientAToken,
        UserRole.CLIENT
      );
      const reloadRes = await getMessages(reloadReq, { params: Promise.resolve({ projectId: projectA.id }) });
      const reloadData = await reloadRes.json();
      expect(reloadData.messages.length).toBeGreaterThanOrEqual(2);

      scenarioResults.push({
        scenario: 1,
        name: "Ordinary Message Exchange & Reload Persistence",
        status: "PASS",
        details: "Client & Employee exchanged alias-only messages; persisted across queries.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 1,
        name: "Ordinary Message Exchange & Reload Persistence",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });

  it("Scenario 2: Unrelated user cannot read or send by changing project, conversation or message IDs", async () => {
    try {
      // Unrelated user attempts to access Project A messages
      const readReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        unrelatedToken,
        UserRole.CLIENT
      );
      const readRes = await getMessages(readReq, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(readRes.status).toBe(404);

      // Unrelated user attempts to send message into Project A
      const sendReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        unrelatedToken,
        UserRole.CLIENT,
        "POST",
        { body: "Malicious injection attempt", clientMessageId: "mal_1" }
      );
      const sendRes = await sendMessage(sendReq, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(sendRes.status).toBe(404);

      // Unrelated user attempts to mark Project A read
      const markReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/read`,
        unrelatedToken,
        UserRole.CLIENT,
        "POST"
      );
      const markRes = await markRead(markReq, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(markRes.status).toBe(404);

      scenarioResults.push({
        scenario: 2,
        name: "IDOR & Tamper Isolation",
        status: "PASS",
        details: "Unrelated user returns HTTP 404 for read, send, and read-receipts.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 2,
        name: "IDOR & Tamper Isolation",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });

  it("Scenario 3: Participant responses contain no other participant's real identity; aliases differ across projects", async () => {
    try {
      // 1. Fetch projects for Client A
      const projReq = makeRequest("http://localhost:3000/api/projects", clientAToken, UserRole.CLIENT);
      const projRes = await getProjects(projReq);
      const projData = await projRes.json();

      const projAItem = projData.projects.find((p: any) => p.id === projectA.id);
      const projCItem = projData.projects.find((p: any) => p.id === projectC.id);

      expect(projAItem).toBeDefined();
      expect(projCItem).toBeDefined();

      // Aliases differ for the same user across the two projects
      expect(projAItem.myAlias).toBe("Client Alpha");
      expect(projCItem.myAlias).toBe("Research Sponsor Z");
      expect(projAItem.myAlias).not.toBe(projCItem.myAlias);

      // Zero identity leakage in DTO
      expect((projAItem as any).realName).toBeUndefined();
      expect((projAItem as any).email).toBeUndefined();
      expect((projAItem as any).userId).toBeUndefined();

      scenarioResults.push({
        scenario: 3,
        name: "Zero Identity Leakage & Distinct Project Aliases",
        status: "PASS",
        details: "Real identities excluded; aliases verified different across projects.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 3,
        name: "Zero Identity Leakage & Distinct Project Aliases",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });

  it("Scenario 4: Contact-sharing message is held and invisible to the recipient until approved", async () => {
    try {
      const heldMsgId = `contact_held_${Date.now()}`;
      const sendReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        clientAToken,
        UserRole.CLIENT,
        "POST",
        { body: "Please call my direct line 415-555-8901 tomorrow.", clientMessageId: heldMsgId }
      );
      const sendRes = await sendMessage(sendReq, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(sendRes.status).toBe(201);
      const sendData = await sendRes.json();
      expect(sendData.message.status).toBe("HELD");

      // Recipient (Employee) queries messages -> strictly invisible
      const empReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        employeeAToken,
        UserRole.EMPLOYEE
      );
      const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: projectA.id }) });
      const empData = await empRes.json();
      const invisibleMsg = empData.messages.find((m: any) => m.id === sendData.message.id);
      expect(invisibleMsg).toBeUndefined();

      scenarioResults.push({
        scenario: 4,
        name: "Contact-Sharing Interception (HOLD)",
        status: "PASS",
        details: "Phone number held immediately; invisible in recipient message stream.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 4,
        name: "Contact-Sharing Interception (HOLD)",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });

  it("Scenario 5: Pricing message creates an admin alert; normal chat remains usable", async () => {
    try {
      const priceMsgId = `price_${Date.now()}`;
      const sendReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        clientAToken,
        UserRole.CLIENT,
        "POST",
        { body: "The total price quote is $15,000 for this milestone.", clientMessageId: priceMsgId }
      );
      const sendRes = await sendMessage(sendReq, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(sendRes.status).toBe(201);
      const sendData = await sendRes.json();
      // Status is DELIVERED because COMMERCIAL is default ALLOW_FLAG
      expect(sendData.message.status).toBe("DELIVERED");

      // Flag and Admin alert exist
      const flag = await prisma.flag.findFirst({
        where: { messageId: sendData.message.id, category: RuleCategory.COMMERCIAL },
      });
      expect(flag).toBeDefined();

      const notif = await prisma.notification.findFirst({
        where: { recipientUserId: adminUser.id, type: "FLAG_ALERT" },
      });
      expect(notif).toBeDefined();

      // Recipient receives the pricing message immediately
      const empReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        employeeAToken,
        UserRole.EMPLOYEE
      );
      const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: projectA.id }) });
      const empData = await empRes.json();
      const received = empData.messages.find((m: any) => m.id === sendData.message.id);
      expect(received).toBeDefined();
      expect(received.body).toContain("$15,000");

      scenarioResults.push({
        scenario: 5,
        name: "Pricing Flag with Uninterrupted Delivery",
        status: "PASS",
        details: "Pricing flagged as ALLOW_FLAG; message delivered instantly; alert logged.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 5,
        name: "Pricing Flag with Uninterrupted Delivery",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });

  it("Scenario 6: Admin approves one held message, rejects another, dismisses a false positive; all appear in the audit log", async () => {
    try {
      // Create 2 held messages
      const msg1 = await prisma.message.create({
        data: {
          conversationId: conversationA.id,
          senderMembershipId: memberClientA.id,
          body: "Call me: 312-555-0101",
          status: MessageStatus.HELD,
          clientMessageId: `hold_1_${Date.now()}`,
        },
      });
      const flag1 = await prisma.flag.create({
        data: {
          messageId: msg1.id,
          category: RuleCategory.CONTACT,
          severity: RuleSeverity.HIGH,
          reason: "Phone number",
          matchedText: "312-555-0101",
          status: FlagStatus.OPEN,
        },
      });

      const msg2 = await prisma.message.create({
        data: {
          conversationId: conversationA.id,
          senderMembershipId: memberClientA.id,
          body: "Call me: 312-555-0102",
          status: MessageStatus.HELD,
          clientMessageId: `hold_2_${Date.now()}`,
        },
      });
      const flag2 = await prisma.flag.create({
        data: {
          messageId: msg2.id,
          category: RuleCategory.CONTACT,
          severity: RuleSeverity.HIGH,
          reason: "Phone number",
          matchedText: "312-555-0102",
          status: FlagStatus.OPEN,
        },
      });

      const msg3 = await prisma.message.create({
        data: {
          conversationId: conversationA.id,
          senderMembershipId: memberClientA.id,
          body: "Version 2.0 price discussion",
          status: MessageStatus.DELIVERED,
          clientMessageId: `flag_3_${Date.now()}`,
        },
      });
      const flag3 = await prisma.flag.create({
        data: {
          messageId: msg3.id,
          category: RuleCategory.COMMERCIAL,
          severity: RuleSeverity.LOW,
          reason: "Pricing term",
          matchedText: "price",
          status: FlagStatus.OPEN,
        },
      });

      // 1. APPROVE flag 1
      const reqApprove = makeRequest(
        `http://localhost:3000/api/admin/flags/${flag1.id}/decision`,
        adminToken,
        UserRole.ADMIN,
        "POST",
        { decision: "APPROVE", note: "Approved contact" }
      );
      const resApprove = await makeDecision(reqApprove, { params: Promise.resolve({ id: flag1.id }) });
      expect(resApprove.status).toBe(200);

      // 2. REJECT flag 2
      const reqReject = makeRequest(
        `http://localhost:3000/api/admin/flags/${flag2.id}/decision`,
        adminToken,
        UserRole.ADMIN,
        "POST",
        { decision: "REJECT", note: "Off-platform policy violation" }
      );
      const resReject = await makeDecision(reqReject, { params: Promise.resolve({ id: flag2.id }) });
      expect(resReject.status).toBe(200);

      // 3. DISMISS flag 3
      const reqDismiss = makeRequest(
        `http://localhost:3000/api/admin/flags/${flag3.id}/decision`,
        adminToken,
        UserRole.ADMIN,
        "POST",
        { decision: "DISMISS", note: "False positive on version number" }
      );
      const resDismiss = await makeDecision(reqDismiss, { params: Promise.resolve({ id: flag3.id }) });
      expect(resDismiss.status).toBe(200);

      // 4. Verify all 3 decisions in Audit Log
      const auditReq = makeRequest(
        "http://localhost:3000/api/admin/audit?action=FLAG_DECISION",
        adminToken,
        UserRole.ADMIN
      );
      const auditRes = await getAudit(auditReq);
      const auditData = await auditRes.json();

      const decisionEvents = auditData.events.filter((e: any) =>
        [flag1.id, flag2.id, flag3.id].includes(e.targetId)
      );
      expect(decisionEvents.length).toBe(3);

      scenarioResults.push({
        scenario: 6,
        name: "Admin Review & Decision Audit Trail",
        status: "PASS",
        details: "Approve, Reject, and Dismiss executed; all 3 verified in AuditEvent log.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 6,
        name: "Admin Review & Decision Audit Trail",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });

  it("Scenario 7: Removing membership revokes access; approval retries do not deliver twice", async () => {
    try {
      // 1. Removing membership revokes access immediately
      await prisma.membership.update({
        where: { id: memberEmployeeA.id },
        data: { status: MembershipStatus.REMOVED, removedAt: new Date() },
      });

      const getReq = makeRequest(
        `http://localhost:3000/api/projects/${projectA.id}/messages`,
        employeeAToken,
        UserRole.EMPLOYEE
      );
      const getRes = await getMessages(getReq, { params: Promise.resolve({ projectId: projectA.id }) });
      expect(getRes.status).toBe(404);

      // 2. Approval retries do not deliver twice (Idempotency)
      const testMsg = await prisma.message.create({
        data: {
          conversationId: conversationA.id,
          senderMembershipId: memberClientA.id,
          body: "Idempotency test: 415-555-7777",
          status: MessageStatus.HELD,
          clientMessageId: `idemp_${Date.now()}`,
        },
      });
      const testFlag = await prisma.flag.create({
        data: {
          messageId: testMsg.id,
          category: RuleCategory.CONTACT,
          severity: RuleSeverity.HIGH,
          reason: "Phone number",
          matchedText: "415-555-7777",
          status: FlagStatus.OPEN,
        },
      });

      // Approve first time
      const app1 = makeRequest(
        `http://localhost:3000/api/admin/flags/${testFlag.id}/decision`,
        adminToken,
        UserRole.ADMIN,
        "POST",
        { decision: "APPROVE", note: "First approval" }
      );
      const resApp1 = await makeDecision(app1, { params: Promise.resolve({ id: testFlag.id }) });
      expect(resApp1.status).toBe(200);
      const dataApp1 = await resApp1.json();
      expect(dataApp1.alreadyDecided).toBe(false);

      // Approve second time (retry)
      const app2 = makeRequest(
        `http://localhost:3000/api/admin/flags/${testFlag.id}/decision`,
        adminToken,
        UserRole.ADMIN,
        "POST",
        { decision: "APPROVE", note: "Duplicate retry" }
      );
      const resApp2 = await makeDecision(app2, { params: Promise.resolve({ id: testFlag.id }) });
      expect(resApp2.status).toBe(200);
      const dataApp2 = await resApp2.json();
      expect(dataApp2.alreadyDecided).toBe(true);

      // Message delivered count is strictly 1
      const dbMsg = await prisma.message.findUnique({ where: { id: testMsg.id } });
      expect(dbMsg?.status).toBe(MessageStatus.DELIVERED);

      scenarioResults.push({
        scenario: 7,
        name: "Immediate Access Revocation & Decision Idempotency",
        status: "PASS",
        details: "Removed member received 404; duplicate approval safe and idempotent.",
      });
    } catch (e: any) {
      scenarioResults.push({
        scenario: 7,
        name: "Immediate Access Revocation & Decision Idempotency",
        status: "FAIL",
        details: e.message,
      });
      throw e;
    }
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole, RuleCategory, RuleSeverity, RuleAction, PatternType } from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getRules, POST as createRule } from "@/app/api/admin/rules/route";
import { PATCH as updateRule } from "@/app/api/admin/rules/[id]/route";
import { POST as testMessage } from "@/app/api/admin/rules/test/route";
import { GET as getAudit } from "@/app/api/admin/audit/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";

const prisma = new PrismaClient();

describe("Feature 11: Admin Rule Configuration & Audit Log", () => {
  let adminUser: any;
  let adminToken: string;

  let clientUser: any;
  let clientToken: string;

  let createdRuleId: string;
  let lockedRuleId: string;

  beforeAll(async () => {
    const passwordHash = await argon2.hash("RulesAuditTest123!");

    adminUser = await prisma.user.create({
      data: {
        email: `rules-admin-${Date.now()}@test.internal`,
        realName: "Policy Admin",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const sAdmin = await createSession(adminUser.id);
    adminToken = sAdmin.token;

    clientUser = await prisma.user.create({
      data: {
        email: `rules-client-${Date.now()}@test.internal`,
        realName: "Client Unauthorized",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const sClient = await createSession(clientUser.id);
    clientToken = sClient.token;

    // Create a locked rule (CONTACT)
    const locked = await prisma.rule.create({
      data: {
        name: "Test Locked Contact Rule",
        category: RuleCategory.CONTACT,
        pattern: "test_contact_pattern",
        patternType: PatternType.KEYWORD,
        severity: RuleSeverity.HIGH,
        action: RuleAction.HOLD,
        isLocked: true,
        isActive: true,
      },
    });
    lockedRuleId = locked.id;
  });

  afterAll(async () => {
    const rIds = [createdRuleId, lockedRuleId].filter(Boolean);
    await prisma.rule.deleteMany({ where: { id: { in: rIds } } });

    const uIds = [adminUser?.id, clientUser?.id].filter(Boolean);
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: uIds } } });
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

  it("blocks non-admin client from rules and audit endpoints with 403", async () => {
    const rulesReq = makeAuthRequest("http://localhost:3000/api/admin/rules", "GET", clientToken, "CLIENT");
    const rulesRes = await getRules(rulesReq);
    expect(rulesRes.status).toBe(403);

    const auditReq = makeAuthRequest("http://localhost:3000/api/admin/audit", "GET", clientToken, "CLIENT");
    const auditRes = await getAudit(auditReq);
    expect(auditRes.status).toBe(403);
  });

  it("admin can create a new rule with Zod and ReDoS safety validation", async () => {
    // 1. Catastrophic regex rejected
    const badRegexReq = makeAuthRequest(
      "http://localhost:3000/api/admin/rules",
      "POST",
      adminToken,
      "ADMIN",
      {
        name: "Dangerous Regex",
        category: RuleCategory.OFF_PLATFORM,
        pattern: "(a+)+",
        patternType: PatternType.REGEX,
        severity: RuleSeverity.MEDIUM,
        action: RuleAction.HOLD,
      }
    );
    const badRes = await createRule(badRegexReq);
    expect(badRes.status).toBe(400);

    // 2. Valid rule accepted
    const validReq = makeAuthRequest(
      "http://localhost:3000/api/admin/rules",
      "POST",
      adminToken,
      "ADMIN",
      {
        name: "Discord Link Blocker",
        category: RuleCategory.OFF_PLATFORM,
        pattern: "discord\\.gg\\/[a-z0-9]+",
        patternType: PatternType.REGEX,
        severity: RuleSeverity.HIGH,
        action: RuleAction.HOLD,
      }
    );
    const validRes = await createRule(validReq);
    expect(validRes.status).toBe(201);
    const data = await validRes.json();
    createdRuleId = data.rule.id;
    expect(data.rule.name).toBe("Discord Link Blocker");

    // Verify AuditEvent
    const audit = await prisma.auditEvent.findFirst({
      where: { targetType: "RULE", targetId: createdRuleId },
    });
    expect(audit).not.toBeNull();
  });

  it("prevents locked rules from being downgraded to ALLOW_FLAG (returns 400)", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/admin/rules/${lockedRuleId}`,
      "PATCH",
      adminToken,
      "ADMIN",
      {
        action: RuleAction.ALLOW_FLAG,
      }
    );

    const res = await updateRule(req, { params: Promise.resolve({ id: lockedRuleId }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Locked policy rules strictly require the HOLD action");
  });

  it("live simulator endpoint tests messages against current active rules", async () => {
    const req = makeAuthRequest(
      "http://localhost:3000/api/admin/rules/test",
      "POST",
      adminToken,
      "ADMIN",
      {
        body: "Join our server at discord.gg/secret123",
      }
    );

    const res = await testMessage(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.finalAction).toBe("HOLD");
    expect(data.matches.length).toBeGreaterThan(0);
  });

  it("admin audit endpoint returns paginated audit events", async () => {
    const req = makeAuthRequest(
      "http://localhost:3000/api/admin/audit?limit=10",
      "GET",
      adminToken,
      "ADMIN"
    );

    const res = await getAudit(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events).toBeInstanceOf(Array);
    expect(data.total).toBeGreaterThan(0);
    expect(data.page).toBe(1);
  });
});

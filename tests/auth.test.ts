import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { _resetRateLimits } from "@/lib/auth/rate-limit";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const prisma = new PrismaClient();

describe("Authentication & Session Management", () => {
  const testPassword = "ValidTestPassword123!";
  let adminUserId: string;
  let clientUserId: string;
  let employeeUserId: string;
  let deactivatedUserId: string;

  beforeAll(async () => {
    const passwordHash = await argon2.hash(testPassword);

    const admin = await prisma.user.create({
      data: {
        email: `auth-test-admin-${Date.now()}@test.internal`,
        realName: "Test Admin",
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    adminUserId = admin.id;

    const client = await prisma.user.create({
      data: {
        email: `auth-test-client-${Date.now()}@test.internal`,
        realName: "Test Client",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    clientUserId = client.id;

    const employee = await prisma.user.create({
      data: {
        email: `auth-test-employee-${Date.now()}@test.internal`,
        realName: "Test Employee",
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    });
    employeeUserId = employee.id;

    const deactivated = await prisma.user.create({
      data: {
        email: `auth-test-deactivated-${Date.now()}@test.internal`,
        realName: "Deactivated User",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: false, // Inactive
      },
    });
    deactivatedUserId = deactivated.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: {
        userId: { in: [adminUserId, clientUserId, employeeUserId, deactivatedUserId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUserId, clientUserId, employeeUserId, deactivatedUserId] },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    _resetRateLimits();
  });

  it("authenticates ADMIN successfully and returns role", async () => {
    const user = await prisma.user.findUnique({ where: { id: adminUserId } });
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: user!.email, password: testPassword }),
    });

    const res = await loginHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, role: "ADMIN" });

    // Verify session cookie was set on response
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(sessionCookie?.value).toBeDefined();
  });

  it("authenticates CLIENT successfully and returns role", async () => {
    const user = await prisma.user.findUnique({ where: { id: clientUserId } });
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: user!.email, password: testPassword }),
    });

    const res = await loginHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, role: "CLIENT" });
  });

  it("authenticates EMPLOYEE successfully and returns role", async () => {
    const user = await prisma.user.findUnique({ where: { id: employeeUserId } });
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: user!.email, password: testPassword }),
    });

    const res = await loginHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, role: "EMPLOYEE" });
  });

  it("returns identical generic error for wrong password and unknown email (no user enumeration)", async () => {
    const user = await prisma.user.findUnique({ where: { id: clientUserId } });

    // 1. Known email, wrong password
    const reqWrongPw = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: user!.email, password: "wrong-password" }),
    });
    const resWrongPw = await loginHandler(reqWrongPw);
    const dataWrongPw = await resWrongPw.json();

    // 2. Unknown email
    const reqUnknown = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "nonexistent-user@test.internal", password: "some-password" }),
    });
    const resUnknown = await loginHandler(reqUnknown);
    const dataUnknown = await resUnknown.json();

    expect(resWrongPw.status).toBe(401);
    expect(resUnknown.status).toBe(401);
    expect(dataWrongPw.error).toBe("Invalid email or password");
    expect(dataUnknown.error).toBe("Invalid email or password");
    expect(dataWrongPw.error).toBe(dataUnknown.error);
  });

  it("blocks deactivated user from logging in", async () => {
    const user = await prisma.user.findUnique({ where: { id: deactivatedUserId } });
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: user!.email, password: testPassword }),
    });

    const res = await loginHandler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Account is deactivated");
  });

  it("rate limits and locks after repeated failed attempts", async () => {
    const testIp = "192.168.1.100";
    const testEmail = "target@test.internal";

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: testEmail, password: "bad-password" }),
      });
      await loginHandler(req);
    }

    // 6th attempt should be blocked by rate limiter with 429
    const blockedReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": testIp,
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: testEmail, password: "bad-password" }),
    });
    const blockedRes = await loginHandler(blockedReq);
    expect(blockedRes.status).toBe(429);
    const data = await blockedRes.json();
    expect(data.error).toContain("Too many failed login attempts");
  });

  it("logout invalidates the session token in the database", async () => {
    const user = await prisma.user.findUnique({ where: { id: clientUserId } });
    // First login
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: user!.email, password: testPassword }),
    });
    const loginRes = await loginHandler(loginReq);
    const token = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(token).toBeDefined();

    // Verify session exists in DB
    const tokenHash = hashSessionToken(token!);
    const sessionBefore = await prisma.session.findUnique({ where: { tokenHash } });
    expect(sessionBefore).not.toBeNull();

    // Call logout
    const logoutReq = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });
    const logoutRes = await logoutHandler(logoutReq);
    expect(logoutRes.status).toBe(200);

    // Verify session was deleted from DB
    const sessionAfter = await prisma.session.findUnique({ where: { tokenHash } });
    expect(sessionAfter).toBeNull();
  });

  it("/api/auth/me returns role-only for CLIENT without identity details", async () => {
    const user = await prisma.user.findUnique({ where: { id: clientUserId } });
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: user!.email, password: testPassword }),
    });
    const loginRes = await loginHandler(loginReq);
    const token = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;

    const meReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });
    const meRes = await meHandler(meReq);
    expect(meRes.status).toBe(200);
    const data = await meRes.json();

    expect(data).toEqual({ user: { role: "CLIENT" } });
    expect(data.user).not.toHaveProperty("email");
    expect(data.user).not.toHaveProperty("realName");
    expect(data.user).not.toHaveProperty("phone");
    expect(data.user).not.toHaveProperty("id");
  });
});

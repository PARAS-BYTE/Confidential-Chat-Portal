import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, UserRole, MessageStatus, MembershipStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { GET as getProjects } from "@/app/api/projects/route";
import { GET as getMessages, POST as sendMessage } from "@/app/api/projects/[projectId]/messages/route";
import { POST as markRead } from "@/app/api/projects/[projectId]/read/route";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";

const prisma = new PrismaClient();

describe("Features 6 & 7: Projects Inbox & Chat Core", () => {
  let client1User: any;
  let client1Token: string;

  let employee1User: any;
  let employee1Token: string;

  let client2User: any;
  let client2Token: string;

  let projectAlpha: any;
  let conversationAlpha: any;
  let memberClient1Alpha: any;
  let memberEmployee1Alpha: any;

  let projectBeta: any;
  let conversationBeta: any;
  let memberClient2Beta: any;

  beforeAll(async () => {
    const passwordHash = await argon2.hash("ChatCoreTest123!");

    // Create 3 users
    client1User = await prisma.user.create({
      data: {
        email: `chat-client1-${Date.now()}@test.internal`,
        realName: "Client One RealName",
        phone: "+15550001",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const s1 = await createSession(client1User.id);
    client1Token = s1.token;

    employee1User = await prisma.user.create({
      data: {
        email: `chat-emp1-${Date.now()}@test.internal`,
        realName: "Employee One RealName",
        phone: "+15550002",
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    });
    const s2 = await createSession(employee1User.id);
    employee1Token = s2.token;

    client2User = await prisma.user.create({
      data: {
        email: `chat-client2-${Date.now()}@test.internal`,
        realName: "Client Two RealName",
        phone: "+15550003",
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const s3 = await createSession(client2User.id);
    client2Token = s3.token;

    // Create Project Alpha
    projectAlpha = await prisma.project.create({
      data: {
        title: "Project Alpha Test",
        description: "Confidential Alpha Scope",
        status: "ACTIVE",
      },
    });
    conversationAlpha = await prisma.conversation.create({
      data: { projectId: projectAlpha.id },
    });

    memberClient1Alpha = await prisma.membership.create({
      data: {
        userId: client1User.id,
        projectId: projectAlpha.id,
        alias: "Client A",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });

    memberEmployee1Alpha = await prisma.membership.create({
      data: {
        userId: employee1User.id,
        projectId: projectAlpha.id,
        alias: "Project Specialist B",
        role: "EMPLOYEE",
        status: MembershipStatus.ACTIVE,
      },
    });

    // Create Project Beta (Isolated)
    projectBeta = await prisma.project.create({
      data: {
        title: "Project Beta Test",
        description: "Confidential Beta Scope",
        status: "ACTIVE",
      },
    });
    conversationBeta = await prisma.conversation.create({
      data: { projectId: projectBeta.id },
    });

    memberClient2Beta = await prisma.membership.create({
      data: {
        userId: client2User.id,
        projectId: projectBeta.id,
        alias: "Client C",
        role: "CLIENT",
        status: MembershipStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    const projectIds = [projectAlpha?.id, projectBeta?.id].filter(Boolean);
    const userIds = [client1User?.id, employee1User?.id, client2User?.id].filter(Boolean);

    await prisma.message.deleteMany({
      where: { conversation: { projectId: { in: projectIds } } },
    });
    await prisma.readState.deleteMany({
      where: { conversation: { projectId: { in: projectIds } } },
    });
    await prisma.conversation.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.membership.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: projectIds } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

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

  // --- FEATURE 6 TESTS ---

  it("Client 1 sees only Project Alpha and Client 2 sees only Project Beta", async () => {
    // Client 1 query
    const req1 = makeAuthRequest("http://localhost:3000/api/projects", "GET", client1Token);
    const res1 = await getProjects(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.projects).toHaveLength(1);
    expect(data1.projects[0].id).toBe(projectAlpha.id);
    expect(data1.projects[0].myAlias).toBe("Client A");
    expect(data1.projects[0].otherAlias).toBe("Project Specialist B");

    // Client 2 query
    const req2 = makeAuthRequest("http://localhost:3000/api/projects", "GET", client2Token);
    const res2 = await getProjects(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.projects).toHaveLength(1);
    expect(data2.projects[0].id).toBe(projectBeta.id);
    expect(data2.projects[0].myAlias).toBe("Client C");
  });

  it("participant projects API response contains ZERO identity fields", async () => {
    const req = makeAuthRequest("http://localhost:3000/api/projects", "GET", client1Token);
    const res = await getProjects(req);
    const data = await res.json();
    const project = data.projects[0];

    const forbiddenKeys = ["email", "realName", "phone", "userId", "passwordHash", "memberships", "user"];
    for (const key of forbiddenKeys) {
      expect(project).not.toHaveProperty(key);
    }
  });

  // --- FEATURE 7 TESTS ---

  it("sends an ordinary message and persists it", async () => {
    const clientMessageId = `cid_${Date.now()}_1`;
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/messages`,
      "POST",
      client1Token,
      {
        body: "Hello, this is a confidential update regarding the deliverables.",
        clientMessageId,
      }
    );

    const res = await sendMessage(req, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message.body).toBe("Hello, this is a confidential update regarding the deliverables.");
    expect(data.message.senderAlias).toBe("Client A");
    expect(data.message.isMine).toBe(true);
    expect(data.message.status).toBe(MessageStatus.DELIVERED);

    // Verify recipient Employee 1 can read the delivered message
    const empReq = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/messages`,
      "GET",
      employee1Token
    );
    const empRes = await getMessages(empReq, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(empRes.status).toBe(200);
    const empData = await empRes.json();
    expect(empData.messages).toHaveLength(1);
    expect(empData.messages[0].senderAlias).toBe("Client A");
    expect(empData.messages[0].isMine).toBe(false);
  });

  it("enforces message idempotency: duplicate clientMessageId returns existing message without duplication", async () => {
    const clientMessageId = `cid_idempotent_${Date.now()}`;
    const payload = {
      body: "First send attempt message",
      clientMessageId,
    };

    // First send
    const req1 = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/messages`,
      "POST",
      client1Token,
      payload
    );
    const res1 = await sendMessage(req1, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(res1.status).toBe(201);
    const data1 = await res1.json();

    // Second send with same clientMessageId (retry)
    const req2 = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/messages`,
      "POST",
      client1Token,
      payload
    );
    const res2 = await sendMessage(req2, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(res2.status).toBe(200); // 200 OK idempotent return
    const data2 = await res2.json();
    expect(data2.message.id).toBe(data1.message.id);

    // Check count in database is strictly 1
    const count = await prisma.message.count({
      where: {
        senderMembershipId: memberClient1Alpha.id,
        clientMessageId,
      },
    });
    expect(count).toBe(1);
  });

  it("returns 404 (not 403) when user queries another project's messages", async () => {
    // Client 2 attempts to read messages from Project Alpha
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/messages`,
      "GET",
      client2Token
    );
    const res = await getMessages(req, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("Resource not found");
  });

  it("sender cannot be spoofed via request body", async () => {
    const clientMessageId = `cid_spoof_${Date.now()}`;
    // Client 1 passes a fake senderMembershipId in request body
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/messages`,
      "POST",
      client1Token,
      {
        body: "Attempting to spoof sender alias",
        clientMessageId,
        senderMembershipId: memberEmployee1Alpha.id, // spoof attempt
        senderAlias: "Project Specialist B", // spoof attempt
      }
    );

    const res = await sendMessage(req, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    // Sender alias MUST still be Client A (derived strictly from session)
    expect(data.message.senderAlias).toBe("Client A");
    expect(data.message.isMine).toBe(true);
  });

  it("marks conversation as read and updates readState", async () => {
    const req = makeAuthRequest(
      `http://localhost:3000/api/projects/${projectAlpha.id}/read`,
      "POST",
      employee1Token
    );
    const res = await markRead(req, { params: Promise.resolve({ projectId: projectAlpha.id }) });
    expect(res.status).toBe(200);

    const readState = await prisma.readState.findUnique({
      where: {
        membershipId_conversationId: {
          membershipId: memberEmployee1Alpha.id,
          conversationId: conversationAlpha.id,
        },
      },
    });
    expect(readState).not.toBeNull();
    expect(readState!.lastReadAt).not.toBeNull();
  });
});

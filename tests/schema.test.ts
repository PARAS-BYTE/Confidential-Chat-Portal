import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

describe("Database Schema Constraints", () => {
  let testUserId1: string;
  let testUserId2: string;
  let testProjectId: string;
  let testMembershipId: string;
  let testConversationId: string;

  beforeAll(async () => {
    // Create isolated test fixtures
    const user1 = await prisma.user.create({
      data: {
        email: `test-constraint-1-${Date.now()}@test.internal`,
        realName: "Test User One",
        passwordHash: "dummyhash",
        role: UserRole.CLIENT,
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test-constraint-2-${Date.now()}@test.internal`,
        realName: "Test User Two",
        passwordHash: "dummyhash",
        role: UserRole.EMPLOYEE,
      },
    });
    testUserId2 = user2.id;

    const project = await prisma.project.create({
      data: {
        title: `Test Project ${Date.now()}`,
        status: "ACTIVE",
      },
    });
    testProjectId = project.id;

    const conversation = await prisma.conversation.create({
      data: {
        projectId: testProjectId,
      },
    });
    testConversationId = conversation.id;

    const membership1 = await prisma.membership.create({
      data: {
        userId: testUserId1,
        projectId: testProjectId,
        alias: "Test Alias Alpha",
        role: "CLIENT",
      },
    });
    testMembershipId = membership1.id;
  });

  afterAll(async () => {
    // Clean up test fixtures
    try {
      await prisma.project.delete({ where: { id: testProjectId } });
      await prisma.user.deleteMany({
        where: { id: { in: [testUserId1, testUserId2] } },
      });
    } catch {
      // Ignore cleanup errors
    } finally {
      await prisma.$disconnect();
    }
  });

  it("enforces unique alias per project (Membership unique [projectId, alias])", async () => {
    // Attempting to assign the same alias to user2 in the same project should violate unique constraint
    await expect(
      prisma.membership.create({
        data: {
          userId: testUserId2,
          projectId: testProjectId,
          alias: "Test Alias Alpha", // Duplicate alias in same project
          role: "EMPLOYEE",
        },
      })
    ).rejects.toThrow();
  });

  it("enforces unique (senderMembershipId, clientMessageId) for Message idempotency", async () => {
    const clientMessageId = `cmid-${Date.now()}`;

    // First insert succeeds
    await prisma.message.create({
      data: {
        conversationId: testConversationId,
        senderMembershipId: testMembershipId,
        clientMessageId,
        body: "First message attempt",
      },
    });

    // Second insert with exact same clientMessageId from same sender must fail
    await expect(
      prisma.message.create({
        data: {
          conversationId: testConversationId,
          senderMembershipId: testMembershipId,
          clientMessageId,
          body: "Duplicate message attempt with same clientMessageId",
        },
      })
    ).rejects.toThrow();
  });

  it("enforces unique email on User model", async () => {
    const existing = await prisma.user.findUnique({
      where: { id: testUserId1 },
    });

    await expect(
      prisma.user.create({
        data: {
          email: existing!.email, // Duplicate email
          realName: "Imposter User",
          passwordHash: "dummyhash",
          role: UserRole.CLIENT,
        },
      })
    ).rejects.toThrow();
  });

  it("enforces one conversation per project (Conversation unique [projectId])", async () => {
    await expect(
      prisma.conversation.create({
        data: {
          projectId: testProjectId, // Duplicate conversation for same project
        },
      })
    ).rejects.toThrow();
  });
});

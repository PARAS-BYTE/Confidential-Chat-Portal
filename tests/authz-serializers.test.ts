import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, MessageStatus } from "@prisma/client";
import { assertProjectAccess, AuthError } from "@/lib/authz";
import {
  serializeParticipantMessage,
  serializeParticipantProject,
} from "@/lib/serializers";

const prisma = new PrismaClient();

describe("Authorization Layer & Privacy-Safe Serializers", () => {
  let userAId: string;
  let userBId: string;
  let projectAId: string;
  let projectBId: string;
  let membershipAId: string;
  let membershipBId: string;

  beforeAll(async () => {
    // User A in Project Alpha
    const userA = await prisma.user.create({
      data: {
        email: `alice-${Date.now()}@test.internal`,
        realName: "Alice Realname",
        phone: "+15551112222",
        passwordHash: "secret-hash-alice",
        role: UserRole.CLIENT,
      },
    });
    userAId = userA.id;

    // User B in Project Beta
    const userB = await prisma.user.create({
      data: {
        email: `bob-${Date.now()}@test.internal`,
        realName: "Bob Realname",
        phone: "+15553334444",
        passwordHash: "secret-hash-bob",
        role: UserRole.CLIENT,
      },
    });
    userBId = userB.id;

    // Project Alpha
    const projectA = await prisma.project.create({
      data: { title: "Alpha Confidential", status: "ACTIVE" },
    });
    projectAId = projectA.id;

    // Project Beta
    const projectB = await prisma.project.create({
      data: { title: "Beta Confidential", status: "ACTIVE" },
    });
    projectBId = projectB.id;

    // Membership: User A in Alpha only
    const memA = await prisma.membership.create({
      data: {
        userId: userAId,
        projectId: projectAId,
        alias: "Alias A",
        role: "CLIENT",
      },
    });
    membershipAId = memA.id;

    // Membership: User B in Beta only
    const memB = await prisma.membership.create({
      data: {
        userId: userBId,
        projectId: projectBId,
        alias: "Alias B",
        role: "CLIENT",
      },
    });
    membershipBId = memB.id;
  });

  afterAll(async () => {
    try {
      await prisma.project.deleteMany({
        where: { id: { in: [projectAId, projectBId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
      });
    } catch {
      // Ignore cleanup errors
    } finally {
      await prisma.$disconnect();
    }
  });

  describe("Anti-Enumeration & IDOR Protection", () => {
    it("allows user to access their own assigned project", async () => {
      const membership = await assertProjectAccess(userAId, projectAId);
      expect(membership.projectId).toBe(projectAId);
      expect(membership.userId).toBe(userAId);
    });

    it("returns 404 (not 403) when user attempts to access another user's project", async () => {
      // User A attempts to access Project B
      let errorThrown: AuthError | null = null;
      try {
        await assertProjectAccess(userAId, projectBId);
      } catch (err) {
        errorThrown = err as AuthError;
      }

      expect(errorThrown).not.toBeNull();
      // Crucial security invariant: Must be 404 (not 403) so resource existence is never disclosed
      expect(errorThrown?.status).toBe(404);
      expect(errorThrown?.message).toBe("Resource not found");
    });

    it("returns 404 when querying completely nonexistent project ID", async () => {
      let errorThrown: AuthError | null = null;
      try {
        await assertProjectAccess(userAId, "nonexistent-uuid-12345");
      } catch (err) {
        errorThrown = err as AuthError;
      }

      expect(errorThrown?.status).toBe(404);
    });
  });

  describe("Privacy-Safe Serializers (Allow-List Guarantees)", () => {
    it("participantMessageDTO strictly never contains email, realName, phone, userId, or passwordHash", () => {
      const rawMessage = {
        id: "msg-123",
        conversationId: "conv-123",
        senderMembershipId: "membership-sender-456",
        body: "Confidential message body content",
        status: MessageStatus.DELIVERED,
        clientMessageId: "client-msg-789",
        deliveredAt: new Date(),
        createdAt: new Date(),
        senderMembership: {
          alias: "Client Alias",
          // Sensitive data that might exist on raw query:
          userId: "raw-user-id-999",
          email: "victim@example.com",
          realName: "Victim Realname",
          phone: "+15559998888",
          passwordHash: "$argon2id$secret",
        },
      };

      const dto = serializeParticipantMessage(rawMessage as any, "membership-sender-456");

      // Verify allowed fields exist
      expect(dto.id).toBe("msg-123");
      expect(dto.senderAlias).toBe("Client Alias");
      expect(dto.body).toBe("Confidential message body content");
      expect(dto.isMine).toBe(true);

      // Verify forbidden fields are STRICTLY ABSENT
      const forbiddenKeys = [
        "email",
        "realName",
        "phone",
        "userId",
        "passwordHash",
        "senderMembershipId",
        "conversationId",
        "clientMessageId",
      ];

      for (const key of forbiddenKeys) {
        expect(dto).not.toHaveProperty(key);
      }

      // Assert only the exact 7 allowed keys exist
      const keys = Object.keys(dto).sort();
      expect(keys).toEqual(["body", "createdAt", "deliveredAt", "id", "isMine", "senderAlias", "status"]);
    });

    it("participantProjectDTO strictly never contains real identities, userIds, or participant lists", () => {
      const rawProject = {
        id: "proj-123",
        title: "Confidential Project",
        description: "Internal scope",
        status: "ACTIVE",
        createdAt: new Date(),
        // Sensitive data attached on raw relation:
        userId: "raw-user-id-123",
        email: "leak@example.com",
        realName: "Sensitive RealName",
      };

      const dto = serializeParticipantProject({
        project: rawProject as any,
        myAlias: "Client A",
        otherAlias: "Project Specialist B",
        lastMessagePreview: "Draft received",
        lastActivityAt: new Date(),
        unreadCount: 2,
      });

      expect(dto.id).toBe("proj-123");
      expect(dto.title).toBe("Confidential Project");
      expect(dto.myAlias).toBe("Client A");
      expect(dto.otherAlias).toBe("Project Specialist B");
      expect(dto.unreadCount).toBe(2);

      // Ensure no raw user IDs, emails, or real names leak
      const forbiddenKeys = ["email", "realName", "phone", "userId", "passwordHash", "memberships"];
      for (const key of forbiddenKeys) {
        expect(dto).not.toHaveProperty(key);
      }
    });
  });
});

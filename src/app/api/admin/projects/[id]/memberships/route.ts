import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { generateUniqueAlias } from "@/lib/alias";
import { UserRole, MembershipStatus } from "@prisma/client";

const AssignMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole(UserRole.ADMIN, request);
    const { id: projectId } = await context.params;

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const body = await request.json();
    const result = AssignMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { userId } = result.data;

    // Check project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { conversation: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check user exists and is active
    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!targetUser.isActive) {
      return NextResponse.json({ error: "Cannot assign deactivated user" }, { status: 400 });
    }

    const assignedRole = result.data.role || targetUser.role;

    // Check existing membership in this project
    const existingMembership = await db.membership.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (existingMembership && existingMembership.status === MembershipStatus.ACTIVE) {
      return NextResponse.json(
        { error: "User is already an active member of this project" },
        { status: 409 }
      );
    }

    // Generate fresh unique alias
    const freshAlias = await generateUniqueAlias(projectId, userId, assignedRole);

    let membership;
    if (existingMembership) {
      // Re-activate with fresh alias
      membership = await db.membership.update({
        where: { id: existingMembership.id },
        data: {
          status: MembershipStatus.ACTIVE,
          alias: freshAlias,
          role: assignedRole,
          removedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              realName: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      });
    } else {
      membership = await db.membership.create({
        data: {
          userId,
          projectId,
          alias: freshAlias,
          role: assignedRole,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              id: true,
              realName: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      });
    }

    // Ensure ReadState exists for conversation
    if (project.conversation) {
      await db.readState.upsert({
        where: {
          membershipId_conversationId: {
            membershipId: membership.id,
            conversationId: project.conversation.id,
          },
        },
        update: {},
        create: {
          membershipId: membership.id,
          conversationId: project.conversation.id,
        },
      });
    }

    await logAuditEvent({
      actorId: admin.id,
      action: "MEMBER_ASSIGNED",
      targetType: "MEMBERSHIP",
      targetId: membership.id,
      metadata: {
        projectId,
        userId,
        alias: freshAlias,
        role: assignedRole,
      },
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

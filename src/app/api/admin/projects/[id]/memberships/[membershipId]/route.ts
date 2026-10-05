import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { UserRole, MembershipStatus } from "@prisma/client";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; membershipId: string }> }
) {
  try {
    const admin = await requireRole(UserRole.ADMIN, request);
    const { id: projectId, membershipId } = await context.params;

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const membership = await db.membership.findFirst({
      where: {
        id: membershipId,
        projectId,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Update status to REMOVED with timestamp
    const updated = await db.membership.update({
      where: { id: membershipId },
      data: {
        status: MembershipStatus.REMOVED,
        removedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "MEMBER_REMOVED",
      targetType: "MEMBERSHIP",
      targetId: membershipId,
      metadata: {
        projectId,
        userId: membership.userId,
        alias: membership.alias,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Membership revoked successfully",
      membership: updated,
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

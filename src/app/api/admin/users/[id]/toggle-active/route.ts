import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { UserRole } from "@prisma/client";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole(UserRole.ADMIN, request);
    const { id } = await context.params;

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    // Prevent admin from deactivating themselves
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own administrator account" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newActiveState = !user.isActive;

    // Transaction to update user and invalidate sessions if deactivating
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { isActive: newActiveState },
        select: {
          id: true,
          realName: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!newActiveState) {
        // Immediately revoke all active sessions for this user
        await tx.session.deleteMany({ where: { userId: id } });
      }

      return u;
    });

    await logAuditEvent({
      actorId: admin.id,
      action: newActiveState ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      targetType: "USER",
      targetId: id,
      metadata: { previousState: user.isActive, newState: newActiveState },
    });

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

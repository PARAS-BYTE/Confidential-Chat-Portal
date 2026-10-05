import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { UserRole, FlagStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireRole(UserRole.ADMIN, request);

    const [openFlagsCount, unreadNotificationsCount] = await Promise.all([
      db.flag.count({
        where: { status: FlagStatus.OPEN },
      }),
      db.notification.count({
        where: {
          recipientUserId: admin.id,
          readAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      openFlagsCount,
      unreadNotificationsCount,
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

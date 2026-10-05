import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { serializeNotification } from "@/lib/serializers";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications
 * Scoped strictly to the authenticated user.
 * Zero identity leakage.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    const notifications = await db.notification.findMany({
      where: {
        recipientUserId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return NextResponse.json({
      notifications: notifications.map(serializeNotification),
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

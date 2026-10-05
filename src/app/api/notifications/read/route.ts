import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
});

/**
 * POST /api/notifications/read
 * Marks notifications as read for current user.
 * Cannot mark another user's notifications as read.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable (marks all unread as read)
    }

    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { notificationIds } = parsed.data;

    const result = await db.notification.updateMany({
      where: {
        recipientUserId: user.id,
        readAt: null,
        ...(notificationIds && notificationIds.length > 0
          ? { id: { in: notificationIds } }
          : {}),
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

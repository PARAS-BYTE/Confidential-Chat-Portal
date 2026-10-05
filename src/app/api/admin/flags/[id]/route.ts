import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(UserRole.ADMIN, request);
    const { id } = await context.params;

    const flag = await db.flag.findUnique({
      where: { id },
      include: {
        message: {
          include: {
            conversation: {
              include: {
                project: {
                  select: { id: true, title: true, description: true },
                },
              },
            },
            senderMembership: {
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
            },
          },
        },
        reviewedBy: {
          select: { id: true, realName: true, email: true },
        },
      },
    });

    if (!flag) {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }

    const targetMessage = flag.message;

    // Fetch conversation context: 10 messages before and 10 messages after
    const messagesBeforeRaw = await db.message.findMany({
      where: {
        conversationId: targetMessage.conversationId,
        createdAt: { lt: targetMessage.createdAt },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        senderMembership: { select: { alias: true, role: true } },
      },
    });

    const messagesBefore = messagesBeforeRaw.reverse();

    const messagesAfter = await db.message.findMany({
      where: {
        conversationId: targetMessage.conversationId,
        createdAt: { gt: targetMessage.createdAt },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: {
        senderMembership: { select: { alias: true, role: true } },
      },
    });

    // Fetch audit history for this flag
    const auditHistory = await db.auditEvent.findMany({
      where: {
        targetType: "FLAG",
        targetId: id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, realName: true, email: true },
        },
      },
    });

    return NextResponse.json({
      flag,
      context: {
        messagesBefore,
        message: targetMessage,
        messagesAfter,
      },
      auditHistory,
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

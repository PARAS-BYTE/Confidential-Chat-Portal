import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, assertProjectAccess } from "@/lib/authz";
import { serializeParticipantMessage } from "@/lib/serializers";
import { validateOrigin } from "@/lib/auth/csrf";
import { checkMessageRateLimit } from "@/lib/auth/rate-limit";
import { evaluateMessage } from "@/lib/rules";
import { MessageStatus } from "@prisma/client";

const SendMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message exceeds 2000 characters"),
  clientMessageId: z.string().trim().min(1).max(100),
});

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;

    // 1. Enforce active project membership (returns 404 if unauthorized or project not found)
    const membership = await assertProjectAccess(user.id, projectId);

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { conversation: true },
    });

    if (!project || !project.conversation) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const conversationId = project.conversation.id;

    // 2. Query messages
    // Recipient sees DELIVERED messages from the other party; sender sees their own in any state
    const messages = await db.message.findMany({
      where: {
        conversationId,
        OR: [
          { senderMembershipId: membership.id },
          {
            senderMembershipId: { not: membership.id },
            status: MessageStatus.DELIVERED,
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        senderMembership: {
          select: { alias: true },
        },
      },
    });

    const dtos = messages.map((m) =>
      serializeParticipantMessage(m, membership.id)
    );

    return NextResponse.json({ messages: dtos });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireUser(request);
    const { projectId } = await context.params;

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const rateLimit = checkMessageRateLimit(user.id);
    if (rateLimit.isLimited) {
      return NextResponse.json(
        { error: "Too many messages sent. Please slow down." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    // 1. Enforce active membership
    const membership = await assertProjectAccess(user.id, projectId);

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { conversation: true },
    });

    if (!project || !project.conversation) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const bodyJson = await request.json();
    const result = SendMessageSchema.safeParse(bodyJson);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { body, clientMessageId } = result.data;

    // 2. Check Idempotency: same sender + clientMessageId returns existing message
    const existingMessage = await db.message.findUnique({
      where: {
        senderMembershipId_clientMessageId: {
          senderMembershipId: membership.id,
          clientMessageId,
        },
      },
      include: {
        senderMembership: { select: { alias: true } },
      },
    });

    if (existingMessage) {
      return NextResponse.json(
        { message: serializeParticipantMessage(existingMessage, membership.id) },
        { status: 200 }
      );
    }

    // 3. Evaluate moderation rules before delivery
    const activeRules = await db.rule.findMany({ where: { isActive: true } });
    const evalResult = evaluateMessage(body, activeRules);

    const isHeld = evalResult.finalAction === "HOLD";
    const status = isHeld ? MessageStatus.HELD : MessageStatus.DELIVERED;
    const deliveredAt = isHeld ? null : new Date();

    const conversationId = project.conversation.id;

    // 4. Create Message, Flags, and Admin Alerts in ONE atomic transaction
    const newMessage = await db.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderMembershipId: membership.id,
          clientMessageId,
          body,
          status,
          deliveredAt,
        },
        include: {
          senderMembership: { select: { alias: true } },
        },
      });

      // If any rules matched, create Flag records and alert Admins
      if (evalResult.matches.length > 0) {
        for (const match of evalResult.matches) {
          await tx.flag.create({
            data: {
              messageId: msg.id,
              ruleId: match.ruleId || null,
              category: match.category,
              severity: match.severity,
              reason: match.reason,
              matchedText: match.matchedText,
              status: "OPEN",
            },
          });
        }

        // Create alert notification for administrators
        const adminUsers = await tx.user.findMany({
          where: { role: "ADMIN", isActive: true },
          select: { id: true },
        });

        const notificationType = isHeld ? "FLAG_HELD" : "FLAG_ALERT";
        const notificationText = isHeld
          ? `Message held for policy review in ${project.title} (${membership.alias})`
          : `Policy flag triggered in ${project.title} (${membership.alias})`;

        for (const admin of adminUsers) {
          await tx.notification.create({
            data: {
              recipientUserId: admin.id,
              type: notificationType,
              text: notificationText,
            },
          });
        }
      }

      return msg;
    });

    return NextResponse.json(
      { message: serializeParticipantMessage(newMessage, membership.id) },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

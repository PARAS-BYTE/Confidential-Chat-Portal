import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { UserRole, FlagStatus, MessageStatus } from "@prisma/client";

const DecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "DISMISS"]),
  note: z.string().trim().max(500).optional(),
});

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

    const body = await request.json();
    const result = DecisionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { decision, note } = result.data;

    // Execute decision inside atomic transaction with idempotency check
    const transactionResult = await db.$transaction(async (tx) => {
      const flag = await tx.flag.findUnique({
        where: { id },
        include: {
          message: {
            include: {
              senderMembership: true,
            },
          },
        },
      });

      if (!flag) {
        return { error: "Flag not found", status: 404 };
      }

      // Concurrency & Idempotency: if already decided, return existing state safely
      if (flag.status !== FlagStatus.OPEN) {
        return {
          alreadyDecided: true,
          flag,
          messageStatus: flag.message.status,
        };
      }

      const targetFlagStatus =
        decision === "APPROVE"
          ? FlagStatus.APPROVED
          : decision === "REJECT"
          ? FlagStatus.REJECTED
          : FlagStatus.DISMISSED;

      const targetMessageStatus =
        decision === "REJECT" ? MessageStatus.REJECTED : MessageStatus.DELIVERED;

      const deliveredAt =
        targetMessageStatus === MessageStatus.DELIVERED ? new Date() : null;

      // 1. Update Flag
      const updatedFlag = await tx.flag.update({
        where: { id },
        data: {
          status: targetFlagStatus,
          reviewNote: note || null,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      // 2. Update Message
      await tx.message.update({
        where: { id: flag.messageId },
        data: {
          status: targetMessageStatus,
          deliveredAt,
        },
      });

      // 3. Notify Sender with privacy-safe message (zero identities)
      const senderUserId = flag.message.senderMembership.userId;
      const notificationText =
        decision === "REJECT"
          ? "Your message was not delivered as it did not comply with portal policy."
          : "Your held message was approved by CCP Studio.";

      await tx.notification.create({
        data: {
          recipientUserId: senderUserId,
          type: "MESSAGE_DECISION",
          text: notificationText,
        },
      });

      // 4. Log Audit Event
      await logAuditEvent(
        {
          actorId: admin.id,
          action: "FLAG_DECISION",
          targetType: "FLAG",
          targetId: flag.id,
          metadata: {
            decision,
            note: note || undefined,
            messageId: flag.messageId,
            resultingMessageStatus: targetMessageStatus,
          },
        },
        tx
      );

      return {
        alreadyDecided: false,
        flag: updatedFlag,
        messageStatus: targetMessageStatus,
      };
    });

    if ("error" in transactionResult) {
      return NextResponse.json(
        { error: transactionResult.error },
        { status: transactionResult.status }
      );
    }

    return NextResponse.json(transactionResult);
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

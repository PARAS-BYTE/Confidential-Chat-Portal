import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, assertProjectAccess } from "@/lib/authz";
import { serializeParticipantMessage } from "@/lib/serializers";
import { validateOrigin } from "@/lib/auth/csrf";
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

    // 3. Create message (delivering by default in Feature 7 core; rule engine integration in Feature 9)
    const newMessage = await db.message.create({
      data: {
        conversationId: project.conversation.id,
        senderMembershipId: membership.id,
        clientMessageId,
        body,
        status: MessageStatus.DELIVERED,
        deliveredAt: new Date(),
      },
      include: {
        senderMembership: { select: { alias: true } },
      },
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

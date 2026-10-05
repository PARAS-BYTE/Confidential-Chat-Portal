import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { serializeParticipantProject } from "@/lib/serializers";
import { MembershipStatus, MessageStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);

    // 1. Get active memberships for this user
    const memberships = await db.membership.findMany({
      where: {
        userId: user.id,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        project: {
          include: {
            conversation: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    if (memberships.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    // 2. Fetch project details and safe previews for each
    const projectDTOs = await Promise.all(
      memberships.map(async (m) => {
        const conversationId = m.project.conversation?.id;

        // Find counterpart alias (the other active party in this project)
        const counterpart = await db.membership.findFirst({
          where: {
            projectId: m.projectId,
            id: { not: m.id },
            status: MembershipStatus.ACTIVE,
          },
          select: { alias: true },
        });

        const otherAlias = counterpart ? counterpart.alias : "Partner";

        if (!conversationId) {
          return serializeParticipantProject({
            project: m.project,
            myAlias: m.alias,
            otherAlias,
            lastMessagePreview: null,
            lastActivityAt: m.project.createdAt,
            unreadCount: 0,
          });
        }

        // Find last visible message:
        // Visible to me: my own messages in ANY status, OR others' messages in DELIVERED status.
        // HELD messages from others are strictly excluded.
        const lastMessage = await db.message.findFirst({
          where: {
            conversationId,
            OR: [
              { senderMembershipId: m.id },
              {
                senderMembershipId: { not: m.id },
                status: MessageStatus.DELIVERED,
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            senderMembership: { select: { alias: true } },
          },
        });

        // Determine unread count from ReadState
        const readState = await db.readState.findUnique({
          where: {
            membershipId_conversationId: {
              membershipId: m.id,
              conversationId,
            },
          },
        });

        const lastReadAt = readState?.lastReadAt;

        // Unread messages: DELIVERED messages sent by the other party after my lastReadAt
        const unreadCount = await db.message.count({
          where: {
            conversationId,
            senderMembershipId: { not: m.id },
            status: MessageStatus.DELIVERED,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        let previewText: string | null = null;
        if (lastMessage) {
          const senderPrefix =
            lastMessage.senderMembershipId === m.id
              ? "You"
              : lastMessage.senderMembership?.alias || otherAlias;
          // Truncate preview
          const truncatedBody =
            lastMessage.body.length > 55
              ? `${lastMessage.body.substring(0, 55)}...`
              : lastMessage.body;
          previewText = `${senderPrefix}: ${truncatedBody}`;
        }

        return serializeParticipantProject({
          project: m.project,
          myAlias: m.alias,
          otherAlias,
          lastMessagePreview: previewText,
          lastActivityAt: lastMessage?.createdAt || m.project.createdAt,
          unreadCount,
        });
      })
    );

    // Sort by lastActivityAt descending
    projectDTOs.sort((a, b) => {
      const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ projects: projectDTOs });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

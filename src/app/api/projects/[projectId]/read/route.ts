import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertProjectAccess } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";

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

    const membership = await assertProjectAccess(user.id, projectId);

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { conversation: true },
    });

    if (!project || !project.conversation) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const conversationId = project.conversation.id;

    await db.readState.upsert({
      where: {
        membershipId_conversationId: {
          membershipId: membership.id,
          conversationId,
        },
      },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        membershipId: membership.id,
        conversationId,
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

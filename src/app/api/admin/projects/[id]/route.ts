import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { UserRole } from "@prisma/client";

const UpdateProjectSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "ARCHIVED", "COMPLETED"]).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(UserRole.ADMIN, request);
    const { id } = await context.params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                realName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
              },
            },
          },
          orderBy: { alias: "asc" },
        },
        conversation: {
          include: {
            _count: {
              select: { messages: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const result = UpdateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await db.project.update({
      where: { id },
      data: {
        ...(result.data.title ? { title: result.data.title } : {}),
        ...(result.data.description !== undefined ? { description: result.data.description } : {}),
        ...(result.data.status ? { status: result.data.status } : {}),
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "PROJECT_UPDATED",
      targetType: "PROJECT",
      targetId: id,
      metadata: { changes: result.data },
    });

    return NextResponse.json({ project: updated });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

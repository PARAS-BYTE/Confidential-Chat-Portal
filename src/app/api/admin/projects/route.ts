import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { UserRole } from "@prisma/client";

const CreateProjectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole(UserRole.ADMIN, request);

    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
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
          select: {
            id: true,
            _count: {
              select: { messages: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(UserRole.ADMIN, request);

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const body = await request.json();
    const result = CreateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description } = result.data;

    // Create project and its unique conversation in one transaction
    const newProject = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          title,
          description: description || null,
          status: "ACTIVE",
        },
      });

      // Automatically create the 1:1 conversation for this project
      await tx.conversation.create({
        data: {
          projectId: project.id,
        },
      });

      return project;
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "PROJECT_CREATED",
      targetType: "PROJECT",
      targetId: newProject.id,
      metadata: { title: newProject.title },
    });

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

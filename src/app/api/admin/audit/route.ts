import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { UserRole, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireRole(UserRole.ADMIN, request);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const actorId = searchParams.get("actorId");
    const targetType = searchParams.get("targetType");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {};

    if (action && action.trim()) {
      where.action = action.trim();
    }

    if (actorId && actorId.trim()) {
      where.actorId = actorId.trim();
    }

    if (targetType && targetType.trim()) {
      where.targetType = targetType.trim();
    }

    const [events, total] = await Promise.all([
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              realName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      db.auditEvent.count({ where }),
    ]);

    return NextResponse.json({
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

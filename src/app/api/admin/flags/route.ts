import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { UserRole, FlagStatus, RuleCategory, RuleSeverity, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireRole(UserRole.ADMIN, request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as FlagStatus | null;
    const category = searchParams.get("category") as RuleCategory | null;
    const severity = searchParams.get("severity") as RuleSeverity | null;
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");

    const where: Prisma.FlagWhereInput = {};

    if (status && Object.values(FlagStatus).includes(status)) {
      where.status = status;
    }

    if (category && Object.values(RuleCategory).includes(category)) {
      where.category = category;
    }

    if (severity && Object.values(RuleSeverity).includes(severity)) {
      where.severity = severity;
    }

    if (projectId) {
      where.message = {
        conversation: {
          projectId,
        },
      };
    }

    if (search && search.trim()) {
      where.OR = [
        { matchedText: { contains: search.trim(), mode: "insensitive" } },
        { reason: { contains: search.trim(), mode: "insensitive" } },
        {
          message: {
            body: { contains: search.trim(), mode: "insensitive" },
          },
        },
      ];
    }

    const flags = await db.flag.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        message: {
          include: {
            conversation: {
              include: {
                project: {
                  select: { id: true, title: true },
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

    return NextResponse.json({ flags });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

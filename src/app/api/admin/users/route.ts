import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as argon2 from "argon2";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { UserRole } from "@prisma/client";

const CreateUserSchema = z.object({
  realName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.nativeEnum(UserRole),
  password: z.string().min(8).max(100),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole(UserRole.ADMIN, request);

    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        realName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { memberships: true },
        },
      },
    });

    return NextResponse.json({ users });
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
    const result = CreateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { realName, email, phone, role, password } = result.data;

    // Check duplicate email
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }

    const passwordHash = await argon2.hash(password);

    const newUser = await db.user.create({
      data: {
        realName,
        email,
        phone: phone || null,
        role,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        realName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "USER_CREATED",
      targetType: "USER",
      targetId: newUser.id,
      metadata: { role: newUser.role, email: newUser.email },
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

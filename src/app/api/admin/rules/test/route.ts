import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { evaluateMessage } from "@/lib/rules";
import { UserRole } from "@prisma/client";

const TestMessageSchema = z.object({
  body: z.string().max(2000),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole(UserRole.ADMIN, request);

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const body = await request.json();
    const result = TestMessageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const activeRules = await db.rule.findMany({ where: { isActive: true } });
    const evalResult = evaluateMessage(result.data.body, activeRules);

    return NextResponse.json(evalResult);
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

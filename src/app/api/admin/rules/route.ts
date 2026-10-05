import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { validateRegex } from "@/lib/rules";
import { UserRole, RuleCategory, PatternType, RuleSeverity, RuleAction } from "@prisma/client";

export const dynamic = "force-dynamic";

const CreateRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.nativeEnum(RuleCategory),
  pattern: z.string().trim().min(1).max(200),
  patternType: z.nativeEnum(PatternType),
  severity: z.nativeEnum(RuleSeverity),
  action: z.nativeEnum(RuleAction),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole(UserRole.ADMIN, request);

    const rules = await db.rule.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ rules });
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
    const result = CreateRuleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, category, pattern, patternType, severity, action, isActive } = result.data;

    // Contact rules MUST be HOLD
    if (category === RuleCategory.CONTACT && action !== RuleAction.HOLD) {
      return NextResponse.json(
        { error: "Contact policy rules must strictly enforce HOLD action" },
        { status: 400 }
      );
    }

    // Validate regex if regex pattern type
    if (patternType === PatternType.REGEX) {
      const rxCheck = validateRegex(pattern);
      if (!rxCheck.isValid) {
        return NextResponse.json({ error: rxCheck.error }, { status: 400 });
      }
    }

    const isLocked = category === RuleCategory.CONTACT;

    const newRule = await db.rule.create({
      data: {
        name,
        category,
        pattern,
        patternType,
        severity,
        action,
        isActive: isActive !== undefined ? isActive : true,
        isLocked,
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "RULE_CREATED",
      targetType: "RULE",
      targetId: newRule.id,
      metadata: { name: newRule.name, category: newRule.category, action: newRule.action },
    });

    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

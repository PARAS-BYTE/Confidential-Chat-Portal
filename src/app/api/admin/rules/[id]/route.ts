import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateOrigin } from "@/lib/auth/csrf";
import { logAuditEvent } from "@/lib/audit";
import { validateRegex } from "@/lib/rules";
import { UserRole, PatternType, RuleSeverity, RuleAction } from "@prisma/client";

const UpdateRuleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  pattern: z.string().trim().min(1).max(200).optional(),
  patternType: z.nativeEnum(PatternType).optional(),
  severity: z.nativeEnum(RuleSeverity).optional(),
  action: z.nativeEnum(RuleAction).optional(),
  isActive: z.boolean().optional(),
});

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
    const result = UpdateRuleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.rule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // SECURITY INVARIANT: Locked rules cannot be downgraded to ALLOW_FLAG
    if (existing.isLocked && result.data.action && result.data.action !== RuleAction.HOLD) {
      return NextResponse.json(
        { error: "Locked policy rules strictly require the HOLD action" },
        { status: 400 }
      );
    }

    // Validate regex if regex pattern is updated
    const targetPatternType = result.data.patternType || existing.patternType;
    const targetPattern = result.data.pattern || existing.pattern;

    if (targetPatternType === PatternType.REGEX && result.data.pattern) {
      const rxCheck = validateRegex(targetPattern);
      if (!rxCheck.isValid) {
        return NextResponse.json({ error: rxCheck.error }, { status: 400 });
      }
    }

    const updated = await db.rule.update({
      where: { id },
      data: {
        ...(result.data.name ? { name: result.data.name } : {}),
        ...(result.data.pattern ? { pattern: result.data.pattern } : {}),
        ...(result.data.patternType ? { patternType: result.data.patternType } : {}),
        ...(result.data.severity ? { severity: result.data.severity } : {}),
        ...(result.data.action ? { action: result.data.action } : {}),
        ...(result.data.isActive !== undefined ? { isActive: result.data.isActive } : {}),
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "RULE_UPDATED",
      targetType: "RULE",
      targetId: id,
      metadata: { changes: result.data },
    });

    return NextResponse.json({ rule: updated });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

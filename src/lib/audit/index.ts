import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface AuditEventParams {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Strips any sensitive fields (passwords, tokens, secrets) before saving audit metadata.
 */
function sanitizeAuditMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue {
  if (!metadata) return {};

  const sanitized: Record<string, unknown> = {};
  const forbiddenKeys = ["password", "passwordHash", "token", "tokenHash", "secret", "body"];

  for (const [key, value] of Object.entries(metadata)) {
    if (forbiddenKeys.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as Prisma.InputJsonValue;
}

/**
 * Creates an immutable AuditEvent row in the database.
 * Supports optional transaction client.
 */
export async function logAuditEvent(
  params: AuditEventParams,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx || db;
  const sanitizedMeta = sanitizeAuditMetadata(params.metadata);

  await client.auditEvent.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: sanitizedMeta,
    },
  });
}

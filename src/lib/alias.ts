import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Generates a unique alias for a user in a specific project.
 * Enforces @@unique([projectId, alias]).
 * Ensures different projects assign different aliases to the same user.
 */
export async function generateUniqueAlias(
  projectId: string,
  userId: string,
  role: UserRole
): Promise<string> {
  // 1. Get all aliases currently used in this project
  const existingInProject = await db.membership.findMany({
    where: { projectId },
    select: { alias: true },
  });
  const usedInProject = new Set(existingInProject.map((m) => m.alias.toLowerCase()));

  // 2. Get all aliases previously used by this user in ANY project to avoid reuse
  const existingForUser = await db.membership.findMany({
    where: { userId },
    select: { alias: true },
  });
  const usedByUser = new Set(existingForUser.map((m) => m.alias.toLowerCase()));

  const prefix = role === UserRole.CLIENT ? "Client" : "Project Specialist";

  // Try single letter A-Z
  for (const letter of ALPHABET) {
    const candidate = `${prefix} ${letter}`;
    const candidateLower = candidate.toLowerCase();
    if (!usedInProject.has(candidateLower) && !usedByUser.has(candidateLower)) {
      return candidate;
    }
  }

  // Fallback to any letter not used in this project
  for (const letter of ALPHABET) {
    const candidate = `${prefix} ${letter}`;
    if (!usedInProject.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Fallback to numbered suffix: "Client 1", "Client 2", etc.
  let counter = 1;
  while (true) {
    const candidate = `${prefix} ${counter}`;
    if (!usedInProject.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
}

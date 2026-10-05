import { User, UserRole, Membership, MembershipStatus } from "@prisma/client";
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Requires an authenticated user session.
 * Throws 401 AuthError if unauthenticated or deactivated.
 */
export async function requireUser(request?: NextRequest): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user || !user.isActive) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

/**
 * Requires the authenticated user to possess one of the required roles.
 * Throws 403 AuthError if user lacks permission.
 */
export async function requireRole(
  allowedRoles: UserRole | UserRole[],
  request?: NextRequest
): Promise<User> {
  const user = await requireUser(request);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new AuthError("Insufficient permissions", 403);
  }

  return user;
}

/**
 * Asserts that a user has an ACTIVE membership in the given project.
 * Security Invariant:
 * Admin gets access only through admin routes.
 * Returns 404 (not 403) for resources the user cannot access so existence is not revealed.
 */
export async function assertProjectAccess(userId: string, projectId: string): Promise<Membership> {
  if (!userId || !projectId) {
    throw new AuthError("Resource not found", 404);
  }

  const membership = await db.membership.findFirst({
    where: {
      userId,
      projectId,
      status: MembershipStatus.ACTIVE,
    },
    include: {
      project: true,
    },
  });

  if (!membership) {
    // Return 404 instead of 403 to prevent ID enumeration
    throw new AuthError("Resource not found", 404);
  }

  return membership;
}

/**
 * Helper used by chat routes to retrieve active membership.
 * Returns null if not found or not active.
 */
export async function getMembership(userId: string, projectId: string): Promise<Membership | null> {
  return db.membership.findFirst({
    where: {
      userId,
      projectId,
      status: MembershipStatus.ACTIVE,
    },
  });
}

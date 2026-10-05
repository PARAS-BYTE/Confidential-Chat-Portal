import crypto from "crypto";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { User } from "@prisma/client";
import {
  SESSION_COOKIE_NAME,
  ROLE_COOKIE_NAME,
  SESSION_DURATION_DAYS,
  SESSION_DURATION_MS,
} from "./constants";

export {
  SESSION_COOKIE_NAME,
  ROLE_COOKIE_NAME,
  SESSION_DURATION_DAYS,
  SESSION_DURATION_MS,
};

/**
 * Computes SHA-256 hash of the plain session token.
 * Only hashed tokens are stored in the database.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new random 32-byte session token and saves its hash to the database.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a plain session token against the database.
 * Returns the associated User if valid and not expired.
 */
export async function validateSessionToken(token: string): Promise<{ user: User; session: { id: string; expiresAt: Date } } | null> {
  if (!token || token.trim() === "") {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check expiration
  if (Date.now() >= session.expiresAt.getTime()) {
    // Delete expired session
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check if user is active
  if (!session.user.isActive) {
    return null;
  }

  return {
    user: session.user,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
}

/**
 * Invalidates (deletes) a session token from the database.
 */
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await db.session.deleteMany({
    where: { tokenHash },
  }).catch(() => {});
}

/**
 * Reads and validates session from request cookies or Next.js cookies store.
 */
export async function getCurrentUser(request?: NextRequest): Promise<User | null> {
  try {
    let token: string | undefined;

    if (request) {
      token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    } else {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {
        token = undefined;
      }
    }

    if (!token) return null;

    const result = await validateSessionToken(token);
    return result ? result.user : null;
  } catch {
    return null;
  }
}

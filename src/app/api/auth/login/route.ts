import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as argon2 from "argon2";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/session";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "@/lib/auth/rate-limit";
import { validateOrigin } from "@/lib/auth/csrf";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit check
  const rateLimitStatus = checkRateLimit(ip, normalizedEmail);
  if (rateLimitStatus.isLocked) {
    return NextResponse.json(
      { error: "Too many failed login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimitStatus.retryAfterSeconds) } }
    );
  }

  // Look up user
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  const genericAuthError = "Invalid email or password";

  if (!user) {
    recordFailedAttempt(ip, normalizedEmail);
    await argon2.verify("$argon2id$v=19$m=65536,t=3,p=4$dummyhash$dummyhash", password).catch(() => {});
    return NextResponse.json({ error: genericAuthError }, { status: 401 });
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "Account is deactivated. Please contact an administrator." },
      { status: 403 }
    );
  }

  // Verify password with argon2
  const passwordValid = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!passwordValid) {
    const lockInfo = recordFailedAttempt(ip, normalizedEmail);
    if (lockInfo.isLocked) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(lockInfo.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: genericAuthError }, { status: 401 });
  }

  // Authentication succeeded: clear rate limit
  clearRateLimit(ip, normalizedEmail);

  // Create session and set cookie on the response
  const { token, expiresAt } = await createSession(user.id);

  const response = NextResponse.json({
    success: true,
    role: user.role,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  response.cookies.set(ROLE_COOKIE_NAME, user.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

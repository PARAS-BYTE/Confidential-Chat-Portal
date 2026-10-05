import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME, invalidateSession } from "@/lib/auth/session";
import { validateOrigin } from "@/lib/auth/csrf";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await invalidateSession(token);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  response.cookies.set(ROLE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

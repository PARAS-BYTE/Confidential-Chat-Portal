import { NextRequest } from "next/server";

/**
 * Validates Origin/Referer header on mutating requests to guard against CSRF attacks.
 */
export function validateOrigin(request: NextRequest): boolean {
  // Safe methods do not mutate
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || request.nextUrl.host;

  if (!origin) {
    const referer = request.headers.get("referer");
    if (!referer) {
      return process.env.NODE_ENV !== "production";
    }
    try {
      const refererUrl = new URL(referer);
      return refererUrl.host === host;
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

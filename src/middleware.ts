import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static resources and internal Next.js paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userRole = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(sessionToken);

  // 2. Public Auth Routes
  const isLoginPage = pathname === "/login";
  const isLoginApi = pathname === "/api/auth/login";
  const isAccessDeniedPage = pathname === "/access-denied";

  if (isLoginApi) {
    return NextResponse.next();
  }

  // 3. Unauthenticated User Handling
  if (!isAuthenticated) {
    // If requesting login or access-denied, allow
    if (isLoginPage || isAccessDeniedPage) {
      return NextResponse.next();
    }

    // If requesting protected API, return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Otherwise redirect to login page
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Authenticated User on /login or root /
  if (isLoginPage || pathname === "/") {
    if (userRole === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    } else {
      return NextResponse.redirect(new URL("/projects", request.url));
    }
  }

  // 5. Role-based route enforcement
  // A participant (CLIENT/EMPLOYEE) opening /admin gets an access-denied page
  if (pathname.startsWith("/admin")) {
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

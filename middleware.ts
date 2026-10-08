import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isFrozenApiRequest, MAINTENANCE_BODY } from "@/lib/writeFreeze";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Phase 7 write freeze: inert unless WRITE_FREEZE=1. Reads and page navigation are unaffected.
  if (isFrozenApiRequest(request.method, pathname)) {
    return NextResponse.json(MAINTENANCE_BODY, { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" } });
  }

  // Skip middleware for static files, API routes, and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get token from cookie or Authorization header
  const cookieToken = request.cookies.get("token")?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  // Public home and authentication pages never require a token.
  // The registration page is served at /signup (not /register).
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    if (pathname === "/") {
      return NextResponse.next();
    }
    // If already has token, redirect to home
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // For all other pages, require authentication
  if (!token) {
    // Redirect to login if no token
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
    // API requests are only inspected for the write freeze; the handler above passes them through unchanged otherwise.
    "/api/:path*",
  ],
};

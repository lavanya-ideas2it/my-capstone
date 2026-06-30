import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that never need a session.
const PUBLIC = ["/login", "/register"];

// The access token is in-memory (client-only); the httpOnly refresh cookie is
// the only session signal available at the edge. We check its presence here as
// a fast gate — real auth (token verification + role checks) happens in each
// API route handler via requireRole().
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let API routes, Next.js internals, and static files through unconditionally.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("refreshToken");

  // Already logged in — only bounce away from /login (not /register, since
  // admins need /register to create accounts for other users).
  if (hasSession && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // No session on a protected route — redirect to login, preserving destination.
  if (!hasSession && !PUBLIC.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

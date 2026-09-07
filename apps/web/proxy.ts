import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from "@/src/infrastructure/admin-session";
import { SESSION_COOKIE } from "@/src/infrastructure/auth/constants";

// Routes that require a logged-in NAVIO user. This is an *optimistic* check -
// it only confirms a session cookie is present (cheap, runs on prefetches too).
// The real DB-backed validation happens in each page via requireUser().
const USER_PROTECTED_PREFIXES = ["/account", "/history", "/household", "/my-lists"];

function handleAdmin(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!isValidSessionToken(token)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

function handleUser(request: NextRequest): NextResponse {
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return handleAdmin(request);
  }

  if (USER_PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return handleUser(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/account",
    "/account/:path*",
    "/history",
    "/history/:path*",
    "/household",
    "/household/:path*",
    "/my-lists",
    "/my-lists/:path*",
  ],
};

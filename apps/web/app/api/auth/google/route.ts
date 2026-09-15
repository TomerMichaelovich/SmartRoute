import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  isGoogleOAuthConfigured,
} from "@/src/infrastructure/auth/google-oauth";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleRedirectUri,
  safeNextPath,
} from "@/src/infrastructure/auth/google-oauth-http";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google", url.origin));
  }

  const state = randomBytes(16).toString("hex");
  const next = safeNextPath(url.searchParams.get("next"));

  const authUrl = buildGoogleAuthUrl(state, googleRedirectUri(request));
  const res = NextResponse.redirect(authUrl);

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(GOOGLE_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(GOOGLE_NEXT_COOKIE, next, cookieOpts);
  return res;
}

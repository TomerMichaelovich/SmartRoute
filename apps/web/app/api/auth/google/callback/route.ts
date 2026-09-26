import { NextResponse } from "next/server";
import { createSession } from "@/src/infrastructure/auth/session";
import { exchangeGoogleCode } from "@/src/infrastructure/auth/google-oauth";
import { findOrCreateUserFromGoogleProfile } from "@/src/infrastructure/auth/google-user";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleRedirectUri,
  safeNextPath,
} from "@/src/infrastructure/auth/google-oauth-http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const loginError = NextResponse.redirect(new URL("/login?error=google", url.origin));
  loginError.cookies.delete(GOOGLE_STATE_COOKIE);
  loginError.cookies.delete(GOOGLE_NEXT_COOKIE);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GOOGLE_STATE_COOKIE}=`))
    ?.slice(GOOGLE_STATE_COOKIE.length + 1);

  if (!code || !state || !cookieState || state !== cookieState) {
    return loginError;
  }

  let profile;
  try {
    profile = await exchangeGoogleCode(code, googleRedirectUri(request));
  } catch {
    return loginError;
  }

  const user = await findOrCreateUserFromGoogleProfile(profile);
  await createSession(user.id);

  const nextCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GOOGLE_NEXT_COOKIE}=`))
    ?.slice(GOOGLE_NEXT_COOKIE.length + 1);
  const next = safeNextPath(nextCookie ? decodeURIComponent(nextCookie) : null);

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  res.cookies.delete(GOOGLE_NEXT_COOKIE);
  return res;
}

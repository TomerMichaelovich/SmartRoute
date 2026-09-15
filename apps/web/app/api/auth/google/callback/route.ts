import { NextResponse } from "next/server";
import { userRepository } from "@/src/infrastructure/container";
import { createSession } from "@/src/infrastructure/auth/session";
import { exchangeGoogleCode } from "@/src/infrastructure/auth/google-oauth";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleRedirectUri,
  safeNextPath,
} from "@/src/infrastructure/auth/google-oauth-http";

const PROVIDER = "google" as const;

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

  // 1. Known Google identity -> that account.
  // 2. Same email already registered (e.g. via password) -> link Google to it
  //    (Google has verified the address, so this is safe).
  // 3. Otherwise -> new passwordless account.
  let user = await userRepository.findByOAuth(PROVIDER, profile.providerAccountId);
  if (!user) {
    const byEmail = await userRepository.findByEmail(profile.email);
    if (byEmail) {
      await userRepository.linkOAuth(byEmail.id, PROVIDER, profile.providerAccountId);
      user = byEmail;
    } else {
      user = await userRepository.create({
        id: crypto.randomUUID(),
        email: profile.email,
        displayName: profile.displayName,
        passwordHash: null,
      });
      await userRepository.linkOAuth(user.id, PROVIDER, profile.providerAccountId);
    }
  }

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

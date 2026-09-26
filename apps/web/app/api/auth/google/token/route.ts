import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/src/infrastructure/auth/session";
import { isGoogleNativeSignInConfigured, verifyGoogleIdToken } from "@/src/infrastructure/auth/google-oauth";
import { findOrCreateUserFromGoogleProfile } from "@/src/infrastructure/auth/google-user";

const requestSchema = z.object({ idToken: z.string().min(1) });

/**
 * Mobile counterpart of /api/auth/google/callback: the phone runs the
 * OAuth/PKCE dance natively (expo-auth-session, no server round-trip to
 * start it), then hands the resulting id_token here to be verified and
 * turned into a session - see google-oauth.ts's verifyGoogleIdToken.
 */
export async function POST(request: Request) {
  if (!isGoogleNativeSignInConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(parsed.data.idToken);
  } catch {
    return NextResponse.json({ error: "google_verification_failed" }, { status: 401 });
  }

  const user = await findOrCreateUserFromGoogleProfile(profile);
  const { token, expiresAt } = await createSession(user.id);
  return NextResponse.json({ user, token, expiresAt: expiresAt.toISOString() });
}

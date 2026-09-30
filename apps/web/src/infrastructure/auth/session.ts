import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { toEpochMs } from "@smartroute/core/application/analytics/user-insights";
import { sessionRepository } from "@/src/infrastructure/container";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// lastSeenAt feeds the admin's "last active" column. The app polls every few
// seconds, so only write it when it's this stale rather than on every request.
const LAST_SEEN_RESOLUTION_MS = 10 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * The mobile app has no cookie jar worth trusting across app restarts, so it
 * authenticates with a bearer token (stored in expo-secure-store) instead of
 * the httpOnly cookie the browser gets. Route Handlers can read `headers()`
 * same as `cookies()`, so a single Authorization check here covers both
 * transports for every caller of getSessionUserId/destroySession.
 */
async function readRawToken(): Promise<string | undefined> {
  const hdrs = await headers();
  const authHeader = hdrs.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/**
 * Creates a DB-backed session and sets the httpOnly cookie (for web callers;
 * mobile callers ignore the cookie and use the returned raw token instead).
 * The raw token is never itself persisted; the DB stores its SHA-256 so a DB
 * leak can't be replayed as a login.
 */
export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sessionRepository.create({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: expiresAt.toISOString(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return { token: rawToken, expiresAt };
}

/**
 * Reads and validates the current session against the DB. Returns the userId
 * or null. Does not redirect - callers decide (see the DAL's requireUser()).
 */
export async function getSessionUserId(): Promise<string | null> {
  const rawToken = await readRawToken();
  if (!rawToken) return null;

  const session = await sessionRepository.findValidByTokenHash(hashToken(rawToken));
  if (!session) return null;

  if (Date.now() - toEpochMs(session.lastSeenAt) > LAST_SEEN_RESOLUTION_MS) {
    after(() => sessionRepository.touch(session.id, new Date().toISOString()));
  }
  return session.userId;
}

/** Deletes the current session from the DB and clears the cookie (if any). */
export async function destroySession(): Promise<void> {
  const rawToken = await readRawToken();
  if (rawToken) {
    await sessionRepository.deleteByTokenHash(hashToken(rawToken));
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

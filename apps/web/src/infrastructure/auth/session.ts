import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { sessionRepository } from "@/src/infrastructure/container";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a DB-backed session and sets the httpOnly cookie. The raw token is
 * only ever in the cookie; the DB stores its SHA-256 so a DB leak can't be
 * replayed as a login.
 */
export async function createSession(userId: string): Promise<void> {
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
}

/**
 * Reads and validates the current session against the DB. Returns the userId
 * or null. Does not redirect - callers decide (see the DAL's requireUser()).
 */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const session = await sessionRepository.findValidByTokenHash(hashToken(rawToken));
  return session?.userId ?? null;
}

/** Deletes the current session from the DB and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await sessionRepository.deleteByTokenHash(hashToken(rawToken));
  }
  store.delete(SESSION_COOKIE);
}

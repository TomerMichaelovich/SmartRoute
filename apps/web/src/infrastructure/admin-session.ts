import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(expiresAt: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(String(expiresAt)).digest("base64url");
}

/**
 * The session is a `{expiresAt}.{hmac(expiresAt)}` token - stateless (no
 * server-side session store needed for a single shared admin password) and
 * tamper-evident, since only someone holding SESSION_SECRET can produce a
 * signature that verifies.
 */
export function buildSessionToken(): { value: string; expires: Date } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return { value: `${expiresAt}.${sign(expiresAt)}`, expires: new Date(expiresAt) };
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = Buffer.from(sign(expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

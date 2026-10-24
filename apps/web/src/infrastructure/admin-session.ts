import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Who the session belongs to: the owner (ADMIN_PASSWORD), or an admin user at a session version. */
export type AdminSessionSubject = { kind: "owner" } | { kind: "user"; id: string; sessionVersion: number };

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

const encodeSubject = (subject: AdminSessionSubject) =>
  subject.kind === "owner" ? "owner" : `${subject.id}:${subject.sessionVersion}`;

function decodeSubject(raw: string): AdminSessionSubject | null {
  if (raw === "owner") return { kind: "owner" };
  const [id, version] = raw.split(":");
  const sessionVersion = Number(version);
  return id && Number.isInteger(sessionVersion) ? { kind: "user", id, sessionVersion } : null;
}

/**
 * The session is a `{subject}.{expiresAt}.{hmac(subject.expiresAt)}` token -
 * stateless and tamper-evident, since only someone holding SESSION_SECRET can
 * produce a signature that verifies. It only says who logged in; what they may
 * do is read from the database on every request (see presentation/auth/admin.ts),
 * so permission changes and deactivation apply at once.
 */
export function buildSessionToken(subject: AdminSessionSubject): { value: string; expires: Date } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${encodeSubject(subject)}.${expiresAt}`;
  return { value: `${payload}.${sign(payload)}`, expires: new Date(expiresAt) };
}

export function parseSessionToken(token: string | undefined | null): AdminSessionSubject | null {
  if (!token) return null;
  const [subjectRaw, expiresAtRaw, signature] = token.split(".");
  if (!subjectRaw || !expiresAtRaw || !signature) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expected = Buffer.from(sign(`${subjectRaw}.${expiresAtRaw}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return decodeSubject(subjectRaw);
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  return parseSessionToken(token) !== null;
}

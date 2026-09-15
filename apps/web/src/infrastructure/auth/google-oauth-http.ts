export const GOOGLE_STATE_COOKIE = "g_oauth_state";
export const GOOGLE_NEXT_COOKIE = "g_oauth_next";

/** Same-origin absolute path only - never a full URL (open-redirect guard). */
export function safeNextPath(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

/**
 * The OAuth redirect URI must match exactly what's registered in the Google
 * Cloud console. Prefer an explicit NAVIO_APP_URL (production, behind a proxy);
 * fall back to the request origin (local dev).
 */
export function googleRedirectUri(request: Request): string {
  const base = process.env.NAVIO_APP_URL || new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

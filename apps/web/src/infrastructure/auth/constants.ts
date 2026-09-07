/**
 * Isolated from session.ts so `proxy.ts` (middleware) can import just the
 * cookie name without pulling in `next/headers` or the DB client, which
 * aren't available in the proxy runtime.
 */
export const SESSION_COOKIE = "navio_session";

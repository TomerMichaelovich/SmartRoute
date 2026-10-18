import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isValidSessionToken } from "@/src/infrastructure/admin-session";

/**
 * Every admin Server Action calls this first. proxy.ts only gates the /admin
 * pages; a Server Action is reachable by a direct POST from anywhere, so a
 * page-level check never covers it (see Next's data-security guide). Reads
 * the same signed cookie the admin login sets - the admin notices nothing.
 */
export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!isValidSessionToken(token)) {
    throw new Error("Unauthorized");
  }
}

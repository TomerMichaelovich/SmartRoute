import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@smartroute/core/domain/entities/user";
import { userRepository } from "@/src/infrastructure/container";
import { getSessionUserId } from "@/src/infrastructure/auth/session";

/**
 * The single entry point Server Components / Actions / Route Handlers use to
 * read the logged-in user. `cache()` dedupes the cookie read + DB lookup
 * within one render pass. Returns null for guests - never redirects.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return userRepository.findById(userId);
});

/** Use on pages/actions that require a login. Redirects guests to /login. */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

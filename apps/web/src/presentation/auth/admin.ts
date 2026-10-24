import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasAccess, type AdminAccess, type AdminPrincipal } from "@smartroute/core/domain/entities/admin-user";
import { ADMIN_SESSION_COOKIE, parseSessionToken } from "@/src/infrastructure/admin-session";
import { adminUserRepository } from "@/src/infrastructure/container";

/**
 * Who is logged into the admin panel, or null. The cookie names the login;
 * permissions come from the database each time, so an admin user who was
 * deactivated, deleted or had their password reset is out immediately.
 * `cache()` dedupes the lookup within one render pass.
 */
export const getAdminPrincipal = cache(async (): Promise<AdminPrincipal | null> => {
  const subject = parseSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!subject) return null;
  if (subject.kind === "owner") return { kind: "owner" };
  const user = await adminUserRepository.findById(subject.id);
  if (!user || !user.isActive || user.sessionVersion !== subject.sessionVersion) return null;
  return { kind: "user", id: user.id, username: user.username, displayName: user.displayName, permissions: user.permissions };
});

/**
 * Every admin Server Action calls this first. proxy.ts only checks that a
 * session exists; a Server Action is reachable by a direct POST from anywhere,
 * so each one checks its own permission (see Next's data-security guide).
 */
export async function requireAdmin(access: AdminAccess): Promise<AdminPrincipal> {
  const principal = await getAdminPrincipal();
  if (!principal || !hasAccess(principal, access)) {
    throw new Error("Unauthorized");
  }
  return principal;
}

/** The page-level counterpart: no session -> login, no permission -> the dashboard. */
export async function requireAdminPage(access?: AdminAccess): Promise<AdminPrincipal> {
  const principal = await getAdminPrincipal();
  if (!principal) redirect("/admin/login");
  if (access && !hasAccess(principal, access)) redirect("/admin");
  return principal;
}

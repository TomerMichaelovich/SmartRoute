/**
 * What an admin-panel login may do. Pure, so pages, actions, repositories and
 * client forms share one definition.
 *
 * - A section grants that whole part of the panel. "stores" is every store:
 *   creating, deleting, details, price link and mapping.
 * - storeIds grant mapping only (map image, nodes, paths, walkable floor,
 *   products on the map) of those stores, for people who map a branch they
 *   were given and nothing else.
 */
export const ADMIN_SECTIONS = ["stores", "products", "promotions", "customers", "analytics", "staff"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export interface AdminPermissions {
  sections: AdminSection[];
  storeIds: string[];
}

/** A login to the admin panel (not an app user). */
export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  permissions: AdminPermissions;
  isActive: boolean;
  sessionVersion: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AdminPrincipal =
  | { kind: "owner" }
  | { kind: "user"; id: string; username: string; displayName: string; permissions: AdminPermissions };

/** A section name, or mapping one store. */
export type AdminAccess = AdminSection | { mapStore: string };

export function hasSection(principal: AdminPrincipal, section: AdminSection): boolean {
  return principal.kind === "owner" || principal.permissions.sections.includes(section);
}

export function canMapStore(principal: AdminPrincipal, storeId: string): boolean {
  return hasSection(principal, "stores") || (principal.kind === "user" && principal.permissions.storeIds.includes(storeId));
}

export function hasAccess(principal: AdminPrincipal, access: AdminAccess): boolean {
  return typeof access === "string" ? hasSection(principal, access) : canMapStore(principal, access.mapStore);
}

/** Drops anything that isn't a known section or a string id (stored JSON, form input). */
export function normalizePermissions(raw: unknown): AdminPermissions {
  const value = (raw ?? {}) as { sections?: unknown; storeIds?: unknown };
  const sections = Array.isArray(value.sections)
    ? ADMIN_SECTIONS.filter((s) => (value.sections as unknown[]).includes(s))
    : [];
  const storeIds = Array.isArray(value.storeIds)
    ? [...new Set(value.storeIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  return { sections, storeIds };
}

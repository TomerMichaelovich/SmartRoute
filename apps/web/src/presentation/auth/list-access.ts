import "server-only";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { User } from "@smartroute/core/domain/entities/user";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "./dal";

export type ListAccessKind = "guest" | "owner" | "member";

export interface ListAccess {
  user: User | null;
  kind: ListAccessKind;
}

/**
 * Resolves who may act on a list:
 * - guest list (no owner, no household): anyone holding the shareCode.
 * - personal list: only its owner.
 * - household list: only an *active* member (checked live, so removing a
 *   member revokes access on their very next request).
 *
 * Returns null when the caller has no access.
 */
export async function resolveListAccess(list: ShoppingList): Promise<ListAccess | null> {
  const user = await getCurrentUser();

  if (!list.ownerUserId && !list.householdId) {
    return { user, kind: "guest" };
  }

  if (!user) return null;

  if (list.ownerUserId && list.ownerUserId === user.id) {
    return { user, kind: "owner" };
  }

  if (list.householdId) {
    const membership = await householdRepository.getMembership(list.householdId, user.id);
    if (membership && membership.status === "active") {
      return { user, kind: "member" };
    }
  }

  return null;
}

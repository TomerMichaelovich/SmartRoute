import "server-only";
import { NextResponse } from "next/server";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { User } from "@smartroute/core/domain/entities/user";
import { he } from "@smartroute/core/i18n/he";
import { householdRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { resolveListAccess, type ListAccessKind } from "@/src/presentation/auth/list-access";

/**
 * Per-list sharing. Each shared list has its own sharing group, stored in the
 * household tables (households / household_members / household_invites) and
 * linked through shopping_lists.household_id - so members, invite links and
 * join-with-approval all reuse the existing household machinery, one group
 * per list instead of one household per user.
 */

export interface ListAuth {
  user: User;
  list: ShoppingList;
  kind: Exclude<ListAccessKind, "guest">;
}

/** Loads a list by share code and checks the caller is its owner (or, with "member", any participant). */
export async function requireListRole(
  code: string,
  role: "owner" | "member",
): Promise<ListAuth | NextResponse> {
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveListAccess(list);
  if (!access?.user || access.kind === "guest") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (role === "owner" && access.kind !== "owner") {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }
  return { user: access.user, list, kind: access.kind };
}

/** The list's sharing group, created (with the owner as its first member) on first share. */
export async function ensureSharingGroup(list: ShoppingList, owner: User): Promise<string> {
  if (list.householdId) return list.householdId;
  const group = await householdRepository.create(list.name ?? he.myList.defaultName(), owner.id);
  await shoppingListRepository.setHousehold(list.id, group.id);
  return group.id;
}

/** Owner first, then active members, then pending requests. */
export async function listParticipants(list: ShoppingList, owner: User | null): Promise<HouseholdMemberView[]> {
  if (!list.householdId) {
    return owner
      ? [{ userId: owner.id, displayName: owner.displayName, email: owner.email, role: "owner", status: "active" }]
      : [];
  }
  const members = await householdRepository.listMembers(list.householdId);
  const rank = (m: HouseholdMemberView) => (m.role === "owner" ? 0 : m.status === "active" ? 1 : 2);
  return members.sort((a, b) => rank(a) - rank(b));
}

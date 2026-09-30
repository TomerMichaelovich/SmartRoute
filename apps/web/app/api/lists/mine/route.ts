import { NextResponse } from "next/server";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { householdRepository, shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

interface ListSharingSummary {
  role: "owner" | "member";
  /** Active participants, owner included. */
  memberCount: number;
  /** Join requests awaiting the owner's approval (always 0 for a member). */
  pendingCount: number;
}

/**
 * The caller's open lists for the mobile home screen. `lists` holds every
 * active list they own plus the lists others shared with them (a user may
 * keep several - e.g. a weekly shop and a party list), and `sharing` who takes
 * part in each, keyed by list id. `list`/`store` are the most recently
 * updated owned list, kept for app builds that predate multiple lists.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [owned, shared] = await Promise.all([
    shoppingListRepository.findAllActiveByOwner(user.id),
    shoppingListRepository.findSharedWithUser(user.id),
  ]);
  const lists: ShoppingList[] = [...owned, ...shared];

  const sharing: Record<string, ListSharingSummary> = {};
  await Promise.all(
    lists.map(async (l) => {
      if (!l.householdId) {
        sharing[l.id] = { role: "owner", memberCount: 1, pendingCount: 0 };
        return;
      }
      const members = await householdRepository.listMembers(l.householdId);
      const isOwner = l.ownerUserId === user.id || members.some((m) => m.userId === user.id && m.role === "owner");
      sharing[l.id] = {
        role: isOwner ? "owner" : "member",
        memberCount: members.filter((m) => m.status === "active").length,
        pendingCount: isOwner ? members.filter((m) => m.status === "pending").length : 0,
      };
    }),
  );

  const list = owned[0] ?? null;
  const store = list ? await storeRepository.findById(list.storeId) : null;
  return NextResponse.json({ list, store, lists, sharing });
}

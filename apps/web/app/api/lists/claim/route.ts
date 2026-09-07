import { NextResponse } from "next/server";
import { z } from "zod";
import { generateShareCode, normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";
import { he } from "@smartroute/core/i18n/he";

const requestSchema = z.object({
  shareCode: z.string().min(1),
  resolution: z.enum(["keep_existing", "new_empty"]).optional(),
});

/**
 * Attaches a guest's list (identified by its shareCode, held in the browser's
 * localStorage) to the now-logged-in user.
 *
 * - No existing lists on the account  -> claim silently.
 * - Guest list already owned by this user -> no-op (idempotent).
 * - Guest list owned by someone else -> refuse (never steal a list).
 * - Account already has a list -> return `conflict`; the client asks the user
 *   to choose, then re-POSTs with `resolution`. Nothing is ever overwritten.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { shareCode, resolution } = parsed.data;

  const guestList = await shoppingListRepository.findByShareCode(normalizeShareCode(shareCode));
  if (!guestList) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  if (guestList.ownerUserId === user.id) {
    return NextResponse.json({ status: "already_yours", list: guestList });
  }
  if (guestList.ownerUserId && guestList.ownerUserId !== user.id) {
    return NextResponse.json({ status: "not_claimable" });
  }

  const ownedLists = await shoppingListRepository.findByOwner(user.id);

  // --- No prior lists: straightforward claim ---
  if (ownedLists.length === 0) {
    const store = await storeRepository.findById(guestList.storeId);
    await shoppingListRepository.attachToOwner(guestList.id, user.id, {
      name: he.myList.defaultName(store?.name),
      activate: true,
    });
    return NextResponse.json({
      status: "claimed",
      list: { ...guestList, ownerUserId: user.id, isActive: true },
    });
  }

  const currentActive =
    (await shoppingListRepository.findActiveByOwner(user.id)) ?? ownedLists[0];

  // --- Prior lists exist: the user must choose ---
  if (!resolution) {
    return NextResponse.json({
      status: "conflict",
      guestList,
      existingList: currentActive,
      existingCount: ownedLists.length,
    });
  }

  if (resolution === "keep_existing") {
    // Guest list stays ownerless (still openable by its shareCode); just make
    // sure the user has an active list to land on.
    if (!(await shoppingListRepository.findActiveByOwner(user.id))) {
      await shoppingListRepository.setActive(currentActive.id, user.id);
    }
    return NextResponse.json({ status: "kept_existing", list: currentActive });
  }

  // resolution === "new_empty"
  let newCode = generateShareCode();
  while (await shoppingListRepository.findByShareCode(newCode)) {
    newCode = generateShareCode();
  }
  const store = await storeRepository.findById(guestList.storeId);
  const now = new Date().toISOString();
  const fresh: ShoppingList = {
    id: crypto.randomUUID(),
    storeId: guestList.storeId,
    items: [],
    shareCode: newCode,
    ownerUserId: user.id,
    householdId: null,
    name: he.myList.defaultName(store?.name),
    isActive: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await shoppingListRepository.create(fresh);
  await shoppingListRepository.setActive(fresh.id, user.id);
  return NextResponse.json({ status: "new_empty", list: { ...fresh, isActive: true } });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { requireActiveMembership } from "@/src/presentation/auth/household-api";
import { createShoppingList } from "@/src/presentation/lib/create-list";
import { he } from "@smartroute/core/i18n/he";

const bodySchema = z.object({ storeId: z.string().min(1) });

/** REST counterpart of the `createSharedList` Server Action. */
export async function POST(request: Request) {
  const auth = await requireActiveMembership();
  if (auth instanceof NextResponse) return auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const existing = await shoppingListRepository.findByHousehold(auth.membership.householdId);
  if (existing) {
    return NextResponse.json({ list: existing });
  }

  const store = await storeRepository.findById(parsed.data.storeId);
  if (!store) {
    return NextResponse.json({ error: "store_not_found" }, { status: 404 });
  }

  const list = await createShoppingList({
    storeId: parsed.data.storeId,
    rawItems: [],
    ownerUserId: null,
    householdId: auth.membership.householdId,
    name: he.household.sharedList.badge,
  });
  return NextResponse.json({ list }, { status: 201 });
}

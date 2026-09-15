"use server";

import { redirect } from "next/navigation";
import { householdRepository, shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { requireUser } from "@/src/presentation/auth/dal";
import { createShoppingList } from "@/src/presentation/lib/create-list";
import { he } from "@smartroute/core/i18n/he";

/** Create the household's single shared list for a chosen store. */
export async function createSharedList(formData: FormData): Promise<void> {
  const user = await requireUser("/household");
  const storeId = String(formData.get("storeId") ?? "");

  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership || membership.status !== "active") {
    throw new Error("Not an active household member");
  }

  const existing = await shoppingListRepository.findByHousehold(membership.householdId);
  if (existing) redirect("/household/list");

  const store = storeId ? await storeRepository.findById(storeId) : null;
  if (!store) redirect("/household/new-list");

  await createShoppingList({
    storeId,
    rawItems: [],
    ownerUserId: null,
    householdId: membership.householdId,
    name: he.household.sharedList.badge,
  });

  redirect("/household/list");
}

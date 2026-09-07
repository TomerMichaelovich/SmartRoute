"use server";

import { redirect } from "next/navigation";
import { shoppingTripRepository } from "@/src/infrastructure/container";
import { requireUser } from "@/src/presentation/auth/dal";
import { createShoppingList } from "@/src/presentation/lib/create-list";
import { he } from "@smartroute/core/i18n/he";

/** Start a fresh active list pre-filled with a past trip's items. */
export async function repeatTrip(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const user = await requireUser("/history");

  const trip = await shoppingTripRepository.findById(tripId);
  if (!trip || trip.userId !== user.id) {
    throw new Error("Not authorized for this trip");
  }

  const rawItems = trip.items.map((item) => item.rawText).filter(Boolean);
  if (rawItems.length === 0) redirect("/branches");

  const list = await createShoppingList({
    storeId: trip.storeId,
    rawItems,
    ownerUserId: user.id,
    name: he.myList.defaultName(trip.storeName),
  });

  redirect(`/my-list/${list.shareCode}`);
}

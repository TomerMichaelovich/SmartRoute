import { NextResponse } from "next/server";
import { he } from "@smartroute/core/i18n/he";
import { shoppingTripRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";
import { createShoppingList } from "@/src/presentation/lib/create-list";

/**
 * REST counterpart of the web's repeatTrip server action: starts a fresh
 * active list pre-filled with a past trip's items and returns its share code.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const trip = await shoppingTripRepository.findById(tripId);
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (trip.userId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rawItems = trip.items.map((item) => item.rawText).filter(Boolean);
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "empty_trip" }, { status: 400 });
  }

  const list = await createShoppingList({
    storeId: trip.storeId,
    rawItems,
    ownerUserId: user.id,
    name: he.myList.defaultName(trip.storeName),
  });
  return NextResponse.json({ shareCode: list.shareCode }, { status: 201 });
}

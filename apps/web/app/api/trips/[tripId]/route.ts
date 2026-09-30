import { NextResponse } from "next/server";
import { shoppingTripRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/** One completed trip, for its owner only - the mobile trip-detail screen. */
export async function GET(
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
  return NextResponse.json({ trip });
}

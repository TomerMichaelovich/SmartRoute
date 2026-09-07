import { desc, eq } from "drizzle-orm";
import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";
import { db } from "../../db/client";
import { shoppingTrips } from "../../db/schema";
import type { IShoppingTripRepository } from "../interfaces/shopping-trip-repository";
import { shoppingTripSchema } from "../schemas";

export class PgShoppingTripRepository implements IShoppingTripRepository {
  async create(trip: ShoppingTrip): Promise<void> {
    await db
      .insert(shoppingTrips)
      .values(trip)
      .onConflictDoNothing({ target: shoppingTrips.routeId });
  }

  async findById(id: string): Promise<ShoppingTrip | null> {
    const [row] = await db.select().from(shoppingTrips).where(eq(shoppingTrips.id, id));
    return row ? shoppingTripSchema.parse(row) : null;
  }

  async findByUser(userId: string): Promise<ShoppingTrip[]> {
    const rows = await db
      .select()
      .from(shoppingTrips)
      .where(eq(shoppingTrips.userId, userId))
      .orderBy(desc(shoppingTrips.completedAt));
    return rows.map((row) => shoppingTripSchema.parse(row));
  }

  async existsForRoute(routeId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: shoppingTrips.id })
      .from(shoppingTrips)
      .where(eq(shoppingTrips.routeId, routeId));
    return Boolean(row);
  }
}

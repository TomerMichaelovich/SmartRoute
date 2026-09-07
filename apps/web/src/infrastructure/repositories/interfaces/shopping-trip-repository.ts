import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";

export interface IShoppingTripRepository {
  /** Idempotent on routeId - a second call for the same route is a no-op. */
  create(trip: ShoppingTrip): Promise<void>;
  findById(id: string): Promise<ShoppingTrip | null>;
  findByUser(userId: string): Promise<ShoppingTrip[]>;
  existsForRoute(routeId: string): Promise<boolean>;
}

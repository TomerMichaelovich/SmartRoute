import type { Route } from "@/src/domain/entities/route";

export interface IRouteRepository {
  findById(id: string): Promise<Route | null>;
  create(route: Route): Promise<Route>;
}

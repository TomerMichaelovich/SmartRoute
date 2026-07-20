import type { Route } from "@/src/domain/entities/route";
import type { IRouteRepository } from "../interfaces/route-repository";
import { JsonFileStore } from "./json-file-store";
import { routeSchema } from "./schemas";

export class JsonRouteRepository implements IRouteRepository {
  private readonly store = new JsonFileStore<Route>("routes.json", routeSchema);

  async findById(id: string): Promise<Route | null> {
    const all = await this.store.readAll();
    return all.find((r) => r.id === id) ?? null;
  }

  async create(route: Route): Promise<Route> {
    await this.store.mutate((items) => [...items, route]);
    return route;
  }
}

import { eq } from "drizzle-orm";
import type { Route } from "@/src/domain/entities/route";
import { db } from "../../db/client";
import { routes } from "../../db/schema";
import type { IRouteRepository } from "../interfaces/route-repository";
import { routeSchema } from "../schemas";

export class PgRouteRepository implements IRouteRepository {
  async findById(id: string): Promise<Route | null> {
    const [row] = await db.select().from(routes).where(eq(routes.id, id));
    return row ? routeSchema.parse(row) : null;
  }

  async create(route: Route): Promise<Route> {
    await db.insert(routes).values(route);
    return route;
  }
}

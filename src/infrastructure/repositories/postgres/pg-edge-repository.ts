import { eq } from "drizzle-orm";
import type { MapEdge } from "@/src/domain/entities/map-edge";
import { db } from "../../db/client";
import { mapEdges } from "../../db/schema";
import type { IEdgeRepository } from "../interfaces/edge-repository";
import { mapEdgeSchema } from "../schemas";
import { cleanPatch } from "./patch-utils";

export class PgEdgeRepository implements IEdgeRepository {
  async findByStore(storeId: string): Promise<MapEdge[]> {
    const rows = await db.select().from(mapEdges).where(eq(mapEdges.storeId, storeId));
    return rows.map((row) => mapEdgeSchema.parse(row));
  }

  async findById(id: string): Promise<MapEdge | null> {
    const [row] = await db.select().from(mapEdges).where(eq(mapEdges.id, id));
    return row ? mapEdgeSchema.parse(row) : null;
  }

  async create(edge: MapEdge): Promise<MapEdge> {
    await db.insert(mapEdges).values(edge);
    return edge;
  }

  async update(id: string, patch: Partial<MapEdge>): Promise<MapEdge> {
    const [row] = await db
      .update(mapEdges)
      .set(cleanPatch(patch))
      .where(eq(mapEdges.id, id))
      .returning();
    if (!row) throw new Error(`MapEdge not found: ${id}`);
    return mapEdgeSchema.parse(row);
  }

  async delete(id: string): Promise<void> {
    await db.delete(mapEdges).where(eq(mapEdges.id, id));
  }
}

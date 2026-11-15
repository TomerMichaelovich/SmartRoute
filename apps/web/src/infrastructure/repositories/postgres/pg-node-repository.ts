import { and, eq, inArray, or } from "drizzle-orm";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { GeoPoint } from "@smartroute/core/domain/value-objects/geo-point";
import { db } from "../../db/client";
import { mapEdges, mapNodes } from "../../db/schema";
import type { INodeRepository } from "../interfaces/node-repository";
import { mapNodeSchema } from "../schemas";
import { cleanPatch } from "./patch-utils";

function toDomain(row: typeof mapNodes.$inferSelect): MapNode {
  return mapNodeSchema.parse({
    ...row,
    zone: row.zone ?? undefined,
    iconKey: row.iconKey ?? undefined,
    area: row.area && row.area.length >= 3 ? row.area : undefined,
  });
}

export class PgNodeRepository implements INodeRepository {
  async findByStore(storeId: string): Promise<MapNode[]> {
    const rows = await db.select().from(mapNodes).where(eq(mapNodes.storeId, storeId));
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<MapNode | null> {
    const [row] = await db.select().from(mapNodes).where(eq(mapNodes.id, id));
    return row ? toDomain(row) : null;
  }

  async create(node: MapNode): Promise<MapNode> {
    await db.insert(mapNodes).values(node);
    return node;
  }

  async update(id: string, patch: Partial<MapNode>): Promise<MapNode> {
    const [row] = await db
      .update(mapNodes)
      .set(cleanPatch(patch))
      .where(eq(mapNodes.id, id))
      .returning();
    if (!row) throw new Error(`MapNode not found: ${id}`);
    return toDomain(row);
  }

  async setArea(id: string, area: GeoPoint[] | null): Promise<void> {
    await db.update(mapNodes).set({ area }).where(eq(mapNodes.id, id));
  }

  async delete(id: string): Promise<void> {
    await db.delete(mapNodes).where(eq(mapNodes.id, id));
  }

  async deleteManyWithEdges(storeId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // neon-http has no interactive transactions; batch() runs these as one transaction.
    await db.batch([
      db
        .delete(mapEdges)
        .where(and(eq(mapEdges.storeId, storeId), or(inArray(mapEdges.fromNodeId, ids), inArray(mapEdges.toNodeId, ids)))),
      db.delete(mapNodes).where(and(eq(mapNodes.storeId, storeId), inArray(mapNodes.id, ids))),
    ]);
  }
}

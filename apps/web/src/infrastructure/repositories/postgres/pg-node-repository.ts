import { and, eq, inArray, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { GeoPoint } from "@smartroute/core/domain/value-objects/geo-point";
import { db } from "../../db/client";
import { mapEdges, mapNodes, productListings, storeMapVideos } from "../../db/schema";
import type { INodeRepository, MapChanges } from "../interfaces/node-repository";
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

  async applyMapChanges(storeId: string, changes: MapChanges): Promise<void> {
    const { createdNodes, updatedNodes, deletedNodeIds, createdEdges, deletedEdgeIds, movedVideos } = changes;
    const queries: BatchItem<"pg">[] = [
      ...(createdNodes.length > 0 ? [db.insert(mapNodes).values(createdNodes)] : []),
      ...updatedNodes.map(({ id, ...fields }) =>
        db
          .update(mapNodes)
          .set(fields)
          .where(and(eq(mapNodes.storeId, storeId), eq(mapNodes.id, id))),
      ),
      ...(deletedEdgeIds.length > 0
        ? [db.delete(mapEdges).where(and(eq(mapEdges.storeId, storeId), inArray(mapEdges.id, deletedEdgeIds)))]
        : []),
      ...(createdEdges.length > 0 ? [db.insert(mapEdges).values(createdEdges)] : []),
      ...(deletedNodeIds.length > 0
        ? [
            db
              .delete(mapEdges)
              .where(
                and(
                  eq(mapEdges.storeId, storeId),
                  or(inArray(mapEdges.fromNodeId, deletedNodeIds), inArray(mapEdges.toNodeId, deletedNodeIds)),
                ),
              ),
            db
              .delete(productListings)
              .where(and(eq(productListings.storeId, storeId), inArray(productListings.nodeId, deletedNodeIds))),
            db.delete(mapNodes).where(and(eq(mapNodes.storeId, storeId), inArray(mapNodes.id, deletedNodeIds))),
          ]
        : []),
      ...movedVideos.map(({ id, position }) =>
        db
          .update(storeMapVideos)
          .set({ position })
          .where(and(eq(storeMapVideos.storeId, storeId), eq(storeMapVideos.id, id))),
      ),
    ];
    if (queries.length === 0) return;
    // neon-http has no interactive transactions; batch() runs these as one transaction.
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  }
}

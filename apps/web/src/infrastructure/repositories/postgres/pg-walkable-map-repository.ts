import { eq, inArray } from "drizzle-orm";
import type { StoredWalkableMask } from "@smartroute/core/map/walkable/mask";
import { db } from "../../db/client";
import { mapEdges, mapNodes, storeWalkableMasks } from "../../db/schema";
import type { IWalkableMapRepository } from "../interfaces/walkable-map-repository";

export class PgWalkableMapRepository implements IWalkableMapRepository {
  async findMask(storeId: string): Promise<StoredWalkableMask | null> {
    const [row] = await db.select().from(storeWalkableMasks).where(eq(storeWalkableMasks.storeId, storeId));
    return row ? { cols: row.cols, rows: row.rows, rle: row.rle } : null;
  }

  async saveMaskAndReplaceGraph({
    storeId,
    mask,
    deleteNodeIds,
    nodes,
    edges,
  }: Parameters<IWalkableMapRepository["saveMaskAndReplaceGraph"]>[0]): Promise<void> {
    const updatedAt = new Date().toISOString();
    // neon-http has no interactive transactions; batch() runs these as one transaction.
    await db.batch([
      db.delete(mapEdges).where(eq(mapEdges.storeId, storeId)),
      ...(deleteNodeIds.length > 0 ? [db.delete(mapNodes).where(inArray(mapNodes.id, deleteNodeIds))] : []),
      ...(nodes.length > 0 ? [db.insert(mapNodes).values(nodes)] : []),
      ...(edges.length > 0 ? [db.insert(mapEdges).values(edges)] : []),
      db
        .insert(storeWalkableMasks)
        .values({ storeId, cols: mask.cols, rows: mask.rows, rle: mask.rle, updatedAt })
        .onConflictDoUpdate({
          target: storeWalkableMasks.storeId,
          set: { cols: mask.cols, rows: mask.rows, rle: mask.rle, updatedAt },
        }),
    ]);
  }

  async deleteMask(storeId: string): Promise<void> {
    await db.delete(storeWalkableMasks).where(eq(storeWalkableMasks.storeId, storeId));
  }
}

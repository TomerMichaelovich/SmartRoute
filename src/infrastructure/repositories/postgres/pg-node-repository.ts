import { eq } from "drizzle-orm";
import type { MapNode } from "@/src/domain/entities/map-node";
import { db } from "../../db/client";
import { mapNodes } from "../../db/schema";
import type { INodeRepository } from "../interfaces/node-repository";
import { mapNodeSchema } from "../schemas";
import { cleanPatch } from "./patch-utils";

function toDomain(row: typeof mapNodes.$inferSelect): MapNode {
  return mapNodeSchema.parse({
    ...row,
    zone: row.zone ?? undefined,
    iconKey: row.iconKey ?? undefined,
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

  async delete(id: string): Promise<void> {
    await db.delete(mapNodes).where(eq(mapNodes.id, id));
  }
}

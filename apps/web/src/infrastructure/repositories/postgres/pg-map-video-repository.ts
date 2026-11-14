import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { storeMapVideos } from "../../db/schema";
import type { IMapVideoRepository, StoreMapVideo } from "../interfaces/map-video-repository";

export class PgMapVideoRepository implements IMapVideoRepository {
  async findByStore(storeId: string): Promise<StoreMapVideo[]> {
    return db
      .select()
      .from(storeMapVideos)
      .where(eq(storeMapVideos.storeId, storeId))
      .orderBy(asc(storeMapVideos.createdAt));
  }

  async findById(id: string): Promise<StoreMapVideo | null> {
    const [row] = await db.select().from(storeMapVideos).where(eq(storeMapVideos.id, id));
    return row ?? null;
  }

  async create(video: StoreMapVideo): Promise<void> {
    await db.insert(storeMapVideos).values(video);
  }

  async updatePosition(id: string, position: { x: number; y: number }): Promise<void> {
    await db.update(storeMapVideos).set({ position }).where(eq(storeMapVideos.id, id));
  }

  async delete(id: string): Promise<void> {
    await db.delete(storeMapVideos).where(eq(storeMapVideos.id, id));
  }
}

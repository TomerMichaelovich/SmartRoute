/** A video of part of the store, pinned at a normalized (0-1) spot on its map. Admin-only. */
export interface StoreMapVideo {
  id: string;
  storeId: string;
  position: { x: number; y: number };
  title: string;
  videoUrl: string;
  createdAt: string;
}

export interface IMapVideoRepository {
  findByStore(storeId: string): Promise<StoreMapVideo[]>;
  findById(id: string): Promise<StoreMapVideo | null>;
  create(video: StoreMapVideo): Promise<void>;
  updatePosition(id: string, position: { x: number; y: number }): Promise<void>;
  delete(id: string): Promise<void>;
}

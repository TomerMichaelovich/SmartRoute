import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { IEdgeRepository } from "../interfaces/edge-repository";
import { JsonFileStore } from "./json-file-store";
import { mapEdgeSchema } from "./schemas";

export class JsonEdgeRepository implements IEdgeRepository {
  private readonly store = new JsonFileStore<MapEdge>("edges.json", mapEdgeSchema);

  async findByStore(storeId: string): Promise<MapEdge[]> {
    const all = await this.store.readAll();
    return all.filter((e) => e.storeId === storeId);
  }

  async findById(id: string): Promise<MapEdge | null> {
    const all = await this.store.readAll();
    return all.find((e) => e.id === id) ?? null;
  }

  async create(edge: MapEdge): Promise<MapEdge> {
    await this.store.mutate((items) => [...items, edge]);
    return edge;
  }

  async update(id: string, patch: Partial<MapEdge>): Promise<MapEdge> {
    let updated: MapEdge | undefined;
    await this.store.mutate((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch, id: item.id };
        return updated;
      }),
    );
    if (!updated) throw new Error(`MapEdge not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((items) => items.filter((item) => item.id !== id));
  }
}

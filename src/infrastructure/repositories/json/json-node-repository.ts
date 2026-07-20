import type { MapNode } from "@/src/domain/entities/map-node";
import type { INodeRepository } from "../interfaces/node-repository";
import { JsonFileStore } from "./json-file-store";
import { mapNodeSchema } from "./schemas";

export class JsonNodeRepository implements INodeRepository {
  private readonly store = new JsonFileStore<MapNode>("nodes.json", mapNodeSchema);

  async findByStore(storeId: string): Promise<MapNode[]> {
    const all = await this.store.readAll();
    return all.filter((n) => n.storeId === storeId);
  }

  async findById(id: string): Promise<MapNode | null> {
    const all = await this.store.readAll();
    return all.find((n) => n.id === id) ?? null;
  }

  async create(node: MapNode): Promise<MapNode> {
    await this.store.mutate((items) => [...items, node]);
    return node;
  }

  async update(id: string, patch: Partial<MapNode>): Promise<MapNode> {
    let updated: MapNode | undefined;
    await this.store.mutate((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch, id: item.id };
        return updated;
      }),
    );
    if (!updated) throw new Error(`MapNode not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((items) => items.filter((item) => item.id !== id));
  }
}

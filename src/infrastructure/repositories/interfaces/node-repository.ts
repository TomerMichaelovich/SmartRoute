import type { MapNode } from "@/src/domain/entities/map-node";

export interface INodeRepository {
  findByStore(storeId: string): Promise<MapNode[]>;
  findById(id: string): Promise<MapNode | null>;
  create(node: MapNode): Promise<MapNode>;
  update(id: string, patch: Partial<MapNode>): Promise<MapNode>;
  delete(id: string): Promise<void>;
}

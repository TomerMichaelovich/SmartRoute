import type { MapEdge } from "@/src/domain/entities/map-edge";

export interface IEdgeRepository {
  findByStore(storeId: string): Promise<MapEdge[]>;
  findById(id: string): Promise<MapEdge | null>;
  create(edge: MapEdge): Promise<MapEdge>;
  update(id: string, patch: Partial<MapEdge>): Promise<MapEdge>;
  delete(id: string): Promise<void>;
}

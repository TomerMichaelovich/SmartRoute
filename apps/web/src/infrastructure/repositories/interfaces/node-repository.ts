import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { GeoPoint } from "@smartroute/core/domain/value-objects/geo-point";

export interface INodeRepository {
  findByStore(storeId: string): Promise<MapNode[]>;
  findById(id: string): Promise<MapNode | null>;
  create(node: MapNode): Promise<MapNode>;
  update(id: string, patch: Partial<MapNode>): Promise<MapNode>;
  /** Sets (or, with null, clears) a department's floor area. */
  setArea(id: string, area: GeoPoint[] | null): Promise<void>;
  delete(id: string): Promise<void>;
  /** Deletes these nodes and every edge touching them, as one transaction. */
  deleteManyWithEdges(storeId: string, ids: string[]): Promise<void>;
}

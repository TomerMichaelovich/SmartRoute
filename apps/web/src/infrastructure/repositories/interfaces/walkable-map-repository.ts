import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { StoredWalkableMask } from "@smartroute/core/map/walkable/mask";

export interface IWalkableMapRepository {
  findMask(storeId: string): Promise<StoredWalkableMask | null>;
  /**
   * Atomically saves the store's walkable mask and swaps in a regenerated navigation graph:
   * deletes the given waypoints and every edge of the store, then inserts the new waypoints/edges.
   */
  saveMaskAndReplaceGraph(params: {
    storeId: string;
    mask: StoredWalkableMask;
    deleteNodeIds: string[];
    nodes: MapNode[];
    edges: MapEdge[];
  }): Promise<void>;
  deleteMask(storeId: string): Promise<void>;
}

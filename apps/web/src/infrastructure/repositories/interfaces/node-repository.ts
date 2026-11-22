import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { GeoPoint } from "@smartroute/core/domain/value-objects/geo-point";

/** The fields of a saved node the map editor can change; null clears `area` or `shelfId`. */
export interface MapNodePatch {
  id: string;
  label?: string;
  position?: GeoPoint;
  area?: GeoPoint[] | null;
  shelfId?: string | null;
}

/** Everything one "save changes" press of the map editor writes. */
export interface MapChanges {
  createdNodes: MapNode[];
  updatedNodes: MapNodePatch[];
  deletedNodeIds: string[];
  createdEdges: MapEdge[];
  deletedEdgeIds: string[];
  movedVideos: Array<{ id: string; position: GeoPoint }>;
}

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
  /**
   * Writes a map editor save as one transaction, so a map is never left half saved. A deleted
   * node takes its edges and the product listings on it along.
   */
  applyMapChanges(storeId: string, changes: MapChanges): Promise<void>;
}

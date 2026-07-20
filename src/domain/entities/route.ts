import type { MapNodeType } from "./map-node";

export interface RouteStop {
  order: number;
  nodeId: string;
  itemIds: string[];
  label: string;
  type: MapNodeType;
}

export interface Route {
  id: string;
  storeId: string;
  shoppingListId: string;
  stops: RouteStop[];
  /** Full walked path node ids (incl. intersections/waypoints), for drawing on the map. */
  pathNodeIds: string[];
  totalDistanceMeters: number;
  backtrackCount: number;
  unresolvedItemIds: string[];
  createdAt: string;
}

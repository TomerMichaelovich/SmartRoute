import type { MapNodeType } from "./map-node";

export interface RouteStop {
  order: number;
  nodeId: string;
  itemIds: string[];
  label: string;
  type: MapNodeType;
  /** Walked path node ids from the previous stop (or entrance, for the first stop) to this one. */
  pathFromPrevious: string[];
  /** Walked path node ids from this stop directly to checkout. */
  pathToCheckout: string[];
  /**
   * Other places in the store carrying what an item here names ("קולה": the six-packs
   * stand elsewhere), for the map to mark. Only items the shopper hasn't pinned to one product.
   */
  alsoAt?: { itemId: string; nodeIds: string[] }[];
}

export interface Route {
  id: string;
  storeId: string;
  shoppingListId: string;
  stops: RouteStop[];
  /** Full walked path node ids (incl. intersections/waypoints), for drawing on the map. */
  pathNodeIds: string[];
  /** Walked path node ids from the last stop to checkout. */
  checkoutPathNodeIds: string[];
  totalDistanceMeters: number;
  backtrackCount: number;
  unresolvedItemIds: string[];
  createdAt: string;
}

import type { GeoPoint } from "../value-objects/geo-point";

/**
 * "exit" is the way out past the checkouts: shown to the shopper like the entrance, but never a
 * place a route starts from or walks through.
 */
export type MapNodeType = "entrance" | "checkout" | "exit" | "waypoint" | "department";

export interface MapNode {
  id: string;
  storeId: string;
  type: MapNodeType;
  label: string;
  position: GeoPoint;
  zone?: string;
  /** Key into PRODUCT_ICONS (src/presentation/product-icons.ts), for the admin layout editor's icon rendering. */
  iconKey?: string;
  /**
   * Departments only: the floor area the department covers, as a polygon of normalized (0..1)
   * map points drawn in the admin editor. The shopper's map lights it up while it's the next stop.
   */
  area?: GeoPoint[];
}

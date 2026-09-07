import type { GeoPoint } from "../value-objects/geo-point";

export type MapNodeType = "entrance" | "checkout" | "waypoint" | "department";

export interface MapNode {
  id: string;
  storeId: string;
  type: MapNodeType;
  label: string;
  position: GeoPoint;
  zone?: string;
  /** Key into PRODUCT_ICONS (src/presentation/product-icons.ts), for the admin layout editor's icon rendering. */
  iconKey?: string;
}

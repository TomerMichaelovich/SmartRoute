import type { GeoPoint } from "../value-objects/geo-point";

export type MapNodeType =
  | "entrance"
  | "checkout"
  | "aisle"
  | "department"
  | "intersection"
  | "waypoint"
  | "product_point";

export interface MapNode {
  id: string;
  storeId: string;
  type: MapNodeType;
  label: string;
  position: GeoPoint;
  zone?: string;
}

import type { MapNodeType } from "@/src/domain/entities/map-node";

/** Hebrew display labels for MapNodeType - stored/submitted values stay the English enum. */
export const NODE_TYPE_LABELS: Record<MapNodeType, string> = {
  entrance: "כניסה",
  checkout: "קופה",
  waypoint: "נקודת ציון",
  department: "מחלקה",
};

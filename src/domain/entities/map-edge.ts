export interface MapEdge {
  id: string;
  storeId: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  bidirectional: boolean;
}

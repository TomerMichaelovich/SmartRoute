/** Normalized 0-1 position on a store's floorplan image (fraction of width/height). */
export interface GeoPoint {
  x: number;
  y: number;
}

/**
 * Straight-line distance between two normalized 0-1 positions, scaled by the store's
 * map canvas width/height (relative map-space units, not real-world distance). Computed
 * on demand (never stored), so it's always correct immediately after a node is dragged
 * to a new position.
 */
export function distanceBetweenNodes(a: GeoPoint, b: GeoPoint, mapWidth: number, mapHeight: number): number {
  const dx = (a.x - b.x) * mapWidth;
  const dy = (a.y - b.y) * mapHeight;
  return Math.sqrt(dx * dx + dy * dy);
}

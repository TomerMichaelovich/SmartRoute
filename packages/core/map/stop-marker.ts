type Point = { x: number; y: number };

export type LabelSide = "above" | "below" | "left" | "right";

/** Whether `p` lies inside the polygon (even-odd rule); all points in the same coordinates. */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Where the shopper's map puts a stop's number and name, so they don't cover the department's
 * lit-up area. With an area: on the walking path where it reaches the department - the last
 * point of the path before the department that's outside the area - with the name on the side
 * facing away from the area. Without one (or no such path point): on the department itself,
 * name above, as before. Points are normalized 0-1 map coordinates.
 */
export function stopMarkerPlacement(
  nodeId: string,
  nodePosition: Point,
  area: readonly Point[] | undefined,
  pathNodeIds: readonly string[],
  positionOf: (id: string) => Point | undefined,
  mapWidth: number,
  mapHeight: number,
): { position: Point; labelSide: LabelSide } {
  const fallback = { position: nodePosition, labelSide: "above" as const };
  if (!area || area.length < 3) return fallback;
  const at = pathNodeIds.lastIndexOf(nodeId);
  if (at <= 0) return fallback;

  let position: Point | undefined;
  for (let i = at - 1; i >= 0 && !position; i--) {
    const p = positionOf(pathNodeIds[i]);
    if (p && !pointInPolygon(p, area)) position = p;
  }
  if (!position) return fallback;

  // Away from the area's middle, along whichever axis the marker is farther off it.
  const middle = {
    x: area.reduce((sum, p) => sum + p.x, 0) / area.length,
    y: area.reduce((sum, p) => sum + p.y, 0) / area.length,
  };
  const dx = (position.x - middle.x) * mapWidth;
  const dy = (position.y - middle.y) * mapHeight;
  const labelSide: LabelSide = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "below" : "above";
  return { position, labelSide };
}

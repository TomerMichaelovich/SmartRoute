/**
 * Placement helpers for the store layout editor. Points are normalized 0-1 map coordinates;
 * distances are compared in map units (x by the map's width, y by its height).
 */

export interface Point {
  x: number;
  y: number;
}

/** Where alignment guides were found: a vertical guide at x and/or a horizontal one at y. */
export interface Guides {
  x?: number;
  y?: number;
}

/**
 * Smart alignment guides: lines the point up with any other point whose x (or y) is within
 * `threshold` map units, independently on each axis.
 */
export function snapToGuides(
  point: Point,
  others: readonly Point[],
  threshold: number,
  mapWidth: number,
  mapHeight: number,
): { point: Point; guides: Guides } {
  let bestX: { value: number; d: number } | null = null;
  let bestY: { value: number; d: number } | null = null;
  for (const o of others) {
    const dx = Math.abs(o.x - point.x) * mapWidth;
    const dy = Math.abs(o.y - point.y) * mapHeight;
    if (dx <= threshold && (!bestX || dx < bestX.d)) bestX = { value: o.x, d: dx };
    if (dy <= threshold && (!bestY || dy < bestY.d)) bestY = { value: o.y, d: dy };
  }
  return {
    point: { x: bestX?.value ?? point.x, y: bestY?.value ?? point.y },
    guides: { x: bestX?.value, y: bestY?.value },
  };
}

/**
 * A line from `start` to `point` within `maxDegrees` of horizontal or vertical comes out exactly
 * horizontal or vertical; a steeper or shallower one is left as drawn.
 */
export function autoStraighten(start: Point, point: Point, mapWidth: number, mapHeight: number, maxDegrees: number): Point {
  const dx = Math.abs(point.x - start.x) * mapWidth;
  const dy = Math.abs(point.y - start.y) * mapHeight;
  if (dx === 0 && dy === 0) return point;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle <= maxDegrees) return { x: point.x, y: start.y };
  if (angle >= 90 - maxDegrees) return { x: start.x, y: point.y };
  return point;
}

export type AlignMode = "row" | "column" | "distribute";

/**
 * New positions for the selected nodes: "row" puts them all at their average height, "column"
 * at their average x, and "distribute" spaces them evenly between the two outermost ones along
 * whichever axis they spread out more on (the other coordinate stays).
 */
export function alignPositions<T extends Point & { id: string }>(
  items: readonly T[],
  mode: AlignMode,
  mapWidth: number,
  mapHeight: number,
): Array<{ id: string; x: number; y: number }> {
  if (items.length < 2) return [];
  if (mode === "row") {
    const y = items.reduce((sum, p) => sum + p.y, 0) / items.length;
    return items.map((p) => ({ id: p.id, x: p.x, y }));
  }
  if (mode === "column") {
    const x = items.reduce((sum, p) => sum + p.x, 0) / items.length;
    return items.map((p) => ({ id: p.id, x, y: p.y }));
  }
  if (items.length < 3) return items.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  const xs = items.map((p) => p.x);
  const ys = items.map((p) => p.y);
  const spreadX = (Math.max(...xs) - Math.min(...xs)) * mapWidth;
  const spreadY = (Math.max(...ys) - Math.min(...ys)) * mapHeight;
  const axis: "x" | "y" = spreadX >= spreadY ? "x" : "y";
  const sorted = [...items].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0][axis];
  const step = (sorted[sorted.length - 1][axis] - first) / (sorted.length - 1);
  return sorted.map((p, i) => ({ id: p.id, x: p.x, y: p.y, [axis]: first + step * i }));
}

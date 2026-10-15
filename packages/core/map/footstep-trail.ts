export interface Point {
  x: number;
  y: number;
}

/**
 * Footprint glyph shared by the web and mobile maps: a bare RIGHT foot in a local ~-13..12 unit
 * box, toes toward -Y, big toe and arch on the inner (-X) side. A left foot is the same glyph
 * mirrored on X. Renderers scale it by size / FOOTPRINT_HEIGHT_UNITS.
 */
export const FOOTPRINT_HEIGHT_UNITS = 24;
export const FOOTPRINT_SOLE_PATH =
  "M-1 -7.6C2.2 -7.9 4.4 -5.6 4.1 -2.4C3.9 0.6 3.1 2.6 3.3 5.2C3.5 8.4 2.6 12 0 12C-2.8 12 -3.5 8.6 -3.1 6" +
  "C-2.7 3.9 -0.7 2.4 -1.5 -0.1C-2.3 -1.7 -5.1 -2.6 -5.1 -4.9C-5.1 -6.9 -3.6 -7.5 -1 -7.6Z";
/** Toe ellipses [cx, cy, rx, ry], big toe first. */
export const FOOTPRINT_TOES: readonly (readonly [number, number, number, number])[] = [
  [-3.5, -10.6, 1.75, 2.25],
  [-0.7, -11.4, 1.25, 1.6],
  [1.35, -10.8, 1.1, 1.4],
  [3.0, -9.7, 0.95, 1.2],
  [4.25, -8.2, 0.85, 1.05],
];
/** People walk with their toes turned slightly outward. */
export const FOOTPRINT_TOE_OUT_DEG = 7;

/** SVG transform placing the glyph at a step: rotated along the path, mirrored for the left foot. */
export function footprintTransform(step: FootstepPlacement, size: number): string {
  const scale = size / FOOTPRINT_HEIGHT_UNITS;
  const scaleX = step.side === "left" ? -scale : scale;
  return `translate(${step.x} ${step.y}) rotate(${step.rotationDeg}) scale(${scaleX} ${scale}) rotate(${FOOTPRINT_TOE_OUT_DEG})`;
}

export interface FootstepPlacement extends Point {
  /** Degrees to rotate the footprint glyph so its toes point along the walking direction. */
  rotationDeg: number;
  side: "left" | "right";
}

/**
 * Resamples a walked polyline into evenly-spaced footprints (fixed arc length along the path),
 * alternating a small perpendicular offset per step so consecutive prints read as a left/right
 * walking gait instead of a single centered trail. Falls back to one print at the path's midpoint
 * when the whole path is shorter than a single step, so very short legs (e.g. an adjacent node)
 * still show something on the map.
 */
export function computeFootstepPlacements(
  points: Point[],
  stepDistance: number,
  footOffset: number,
): FootstepPlacement[] {
  const placements: FootstepPlacement[] = [];
  if (points.length < 2 || stepDistance <= 0) return placements;

  let distanceSinceLastStep = 0;
  let stepIndex = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen === 0) continue;
    const dirX = (b.x - a.x) / segLen;
    const dirY = (b.y - a.y) / segLen;
    // The Footprint glyph's toes point toward local -Y (up, unrotated) - a 0deg rotation
    // already faces "up", so +90deg (not -90) aligns it with a direction vector's own angle.
    const rotationDeg = (Math.atan2(dirY, dirX) * 180) / Math.PI + 90;
    const perpX = -dirY;
    const perpY = dirX;

    let offsetIntoSeg = 0;
    let distAvailable = segLen;
    while (distanceSinceLastStep + distAvailable >= stepDistance) {
      const need = stepDistance - distanceSinceLastStep;
      offsetIntoSeg += need;
      const side: FootstepPlacement["side"] = stepIndex % 2 === 0 ? "right" : "left";
      const sideSign = side === "right" ? 1 : -1;
      placements.push({
        x: a.x + dirX * offsetIntoSeg + perpX * footOffset * sideSign,
        y: a.y + dirY * offsetIntoSeg + perpY * footOffset * sideSign,
        rotationDeg,
        side,
      });
      stepIndex++;
      distAvailable -= need;
      distanceSinceLastStep = 0;
    }
    distanceSinceLastStep += distAvailable;
  }

  if (placements.length === 0) {
    const a = points[0];
    const b = points[points.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    placements.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      rotationDeg: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      side: "right",
    });
  }

  return placements;
}

export interface Point {
  x: number;
  y: number;
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

import type { WalkableMask } from "./mask";

/**
 * Zhang-Suen thinning: peels the walkable area down to a 1-cell-wide centerline that keeps its
 * topology - one line down the middle of every aisle, branching where aisles meet. Returns a
 * new grid (1 = centerline cell).
 */
export function skeletonize(mask: WalkableMask): Uint8Array {
  const { cols, rows } = mask;
  const sk = mask.data.slice();
  const at = (y: number, x: number) => (y < 0 || y >= rows || x < 0 || x >= cols ? 0 : sk[y * cols + x]);
  const toRemove: number[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      toRemove.length = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (sk[y * cols + x] !== 1) continue;
          // Clockwise from north: P2..P9.
          const p2 = at(y - 1, x), p3 = at(y - 1, x + 1), p4 = at(y, x + 1), p5 = at(y + 1, x + 1);
          const p6 = at(y + 1, x), p7 = at(y + 1, x - 1), p8 = at(y, x - 1), p9 = at(y - 1, x - 1);
          const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (neighbors < 2 || neighbors > 6) continue;
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let transitions = 0;
          for (let k = 0; k < 8; k++) if (ring[k] === 0 && ring[k + 1] === 1) transitions++;
          if (transitions !== 1) continue;
          if (step === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          toRemove.push(y * cols + x);
        }
      }
      if (toRemove.length > 0) {
        changed = true;
        for (const i of toRemove) sk[i] = 0;
      }
    }
  }
  return sk;
}

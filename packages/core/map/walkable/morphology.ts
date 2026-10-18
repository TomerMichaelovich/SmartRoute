import { type WalkableMask, createMask } from "./mask";

/**
 * Square-kernel (Chebyshev radius r) max filter, done as a horizontal then a vertical pass so
 * the cost doesn't grow with r squared. Cells outside the grid count as `outside`.
 */
function squareFilter(mask: WalkableMask, r: number, keep: 0 | 1): WalkableMask {
  const { cols, rows, data } = mask;
  const tmp = new Uint8Array(cols * rows);
  const out = createMask(cols, rows);
  const other = keep === 1 ? 0 : 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let v = other;
      for (let dx = -r; dx <= r && v !== keep; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < cols && data[y * cols + nx] === keep) v = keep;
      }
      tmp[y * cols + x] = v;
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let v = other;
      for (let dy = -r; dy <= r && v !== keep; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < rows && tmp[ny * cols + x] === keep) v = keep;
      }
      out.data[y * cols + x] = v;
    }
  }
  return out;
}

/** Grows walkable area by r cells. */
export function dilate(mask: WalkableMask, r = 1): WalkableMask {
  return r <= 0 ? { ...mask, data: mask.data.slice() } : squareFilter(mask, r, 1);
}

/** Shrinks walkable area by r cells (grid border counts as blocked). */
export function erode(mask: WalkableMask, r = 1): WalkableMask {
  return r <= 0 ? { ...mask, data: mask.data.slice() } : squareFilter(mask, r, 0);
}

/** Dilate then erode: closes thin gaps such as the grout lines between floor tiles. */
export function close(mask: WalkableMask, r = 1): WalkableMask {
  return erode(dilate(mask, r), r);
}

/** Erode then dilate: removes thin walkable specks and whiskers. */
export function open(mask: WalkableMask, r = 1): WalkableMask {
  return dilate(erode(mask, r), r);
}

/**
 * Chebyshev distance (in cells) from every walkable cell to the nearest blocked cell or the grid
 * border; 0 for blocked cells. Two-pass chamfer transform.
 */
export function distanceToBlocked(mask: WalkableMask): Int32Array {
  const { cols, rows, data } = mask;
  const big = cols + rows;
  const dist = new Int32Array(cols * rows);
  for (let i = 0; i < dist.length; i++) dist[i] = data[i] === 1 ? big : 0;
  const at = (y: number, x: number) => (y < 0 || y >= rows || x < 0 || x >= cols ? 0 : dist[y * cols + x]);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i], at(y - 1, x - 1) + 1, at(y - 1, x) + 1, at(y - 1, x + 1) + 1, at(y, x - 1) + 1);
    }
  }
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i], at(y + 1, x + 1) + 1, at(y + 1, x) + 1, at(y + 1, x - 1) + 1, at(y, x + 1) + 1);
    }
  }
  return dist;
}

/** Turns enclosed blocked islands smaller than maxCells into floor (stains, reflections, labels). */
export function fillSmallHoles(mask: WalkableMask, maxCells: number): WalkableMask {
  const { cols, rows } = mask;
  const out = { ...mask, data: mask.data.slice() };
  const seen = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  for (let start = 0; start < out.data.length; start++) {
    if (out.data[start] === 1 || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    let touchesBorder = false;
    while (head < tail) {
      const i = queue[head++];
      const y = Math.floor(i / cols);
      const x = i % cols;
      if (y === 0 || x === 0 || y === rows - 1 || x === cols - 1) touchesBorder = true;
      for (const [dy, dx] of NEIGHBORS_4) {
        const ny = y + dy;
        const nx = x + dx;
        if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
        const ni = ny * cols + nx;
        if (out.data[ni] === 0 && !seen[ni]) {
          seen[ni] = 1;
          queue[tail++] = ni;
        }
      }
    }
    if (!touchesBorder && tail <= maxCells) {
      for (let k = 0; k < tail; k++) out.data[queue[k]] = 1;
    }
  }
  return out;
}

export const NEIGHBORS_4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

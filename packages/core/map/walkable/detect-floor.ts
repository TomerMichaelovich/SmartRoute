import type { GeoPoint } from "../../domain/value-objects/geo-point";
import { type WalkableMask, createMask, gridSizeFor, normalizedToCell } from "./mask";
import { NEIGHBORS_4, close, fillSmallHoles, open } from "./morphology";

export interface FloorDetectionOptions {
  /**
   * One knob for the admin's "sensitivity" slider: scales every color/texture tolerance below.
   * Higher accepts more (risking shelf edges); lower accepts less (risking shadowed floor).
   */
  sensitivity?: number;
  cols?: number;
  rows?: number;
}

// Base tolerances, tuned on a rendered top-down supermarket photo (beige tiles, busy shelves).
const BASE_CHROMA_TOLERANCE = 8; // red-green / green-blue balance: the floor's tint
const BASE_LUMINANCE_TOLERANCE = 55; // brightness: lighting falls off toward the walls
const BASE_MAX_TEXTURE = 14; // per-cell color std-dev: floor is flat, shelves of products are busy
const HOLE_FILL_CELLS = 12;

/**
 * Finds the store's walkable floor in an RGBA image, starting from one point the admin clicked
 * on the floor. Each grid cell is summarized by its mean color and texture; a cell is floor-like
 * when its tint and brightness are close to the clicked cell's and it is flat (low std-dev).
 * Only floor-like cells connected to the clicked one are kept, so the white page around the
 * store, a logo, etc. never count even when their color happens to match. Finally, grout lines
 * between tiles are closed and single-cell specks removed.
 */
export function detectFloor(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  seed: GeoPoint,
  options: FloorDetectionOptions = {},
): WalkableMask {
  const sensitivity = options.sensitivity ?? 1;
  const grid = options.cols && options.rows ? { cols: options.cols, rows: options.rows } : gridSizeFor(width, height);
  const { cols, rows } = grid;
  const n = cols * rows;
  const meanR = new Float32Array(n);
  const meanG = new Float32Array(n);
  const meanB = new Float32Array(n);
  const texture = new Float32Array(n);

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor((row * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * height) / rows));
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * width) / cols));
      let sr = 0, sg = 0, sb = 0, qr = 0, qg = 0, qb = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * width + x) * 4;
          const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
          sr += r; sg += g; sb += b;
          qr += r * r; qg += g * g; qb += b * b;
          count++;
        }
      }
      const i = row * cols + col;
      meanR[i] = sr / count;
      meanG[i] = sg / count;
      meanB[i] = sb / count;
      const std = (q: number, s: number) => Math.sqrt(Math.max(0, q / count - (s / count) ** 2));
      texture[i] = (std(qr, sr) + std(qg, sg) + std(qb, sb)) / 3;
    }
  }

  const start = normalizedToCell(grid, seed);
  const s = start.row * cols + start.col;
  const seedRg = meanR[s] - meanG[s];
  const seedGb = meanG[s] - meanB[s];
  const seedLum = (meanR[s] + meanG[s] + meanB[s]) / 3;
  const chromaTol = BASE_CHROMA_TOLERANCE * sensitivity;
  const gbTol = BASE_CHROMA_TOLERANCE * 1.25 * sensitivity;
  const lumTol = BASE_LUMINANCE_TOLERANCE * sensitivity;
  const maxTexture = BASE_MAX_TEXTURE * sensitivity;

  const isFloorLike = (i: number) =>
    texture[i] <= maxTexture &&
    Math.abs(meanR[i] - meanG[i] - seedRg) <= chromaTol &&
    Math.abs(meanG[i] - meanB[i] - seedGb) <= gbTol &&
    Math.abs((meanR[i] + meanG[i] + meanB[i]) / 3 - seedLum) <= lumTol;

  const reached = createMask(cols, rows);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  queue[tail++] = s;
  reached.data[s] = 1;
  while (head < tail) {
    const i = queue[head++];
    const y = Math.floor(i / cols);
    const x = i % cols;
    for (const [dy, dx] of NEIGHBORS_4) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
      const ni = ny * cols + nx;
      if (!reached.data[ni] && isFloorLike(ni)) {
        reached.data[ni] = 1;
        queue[tail++] = ni;
      }
    }
  }

  return fillSmallHoles(open(close(reached, 1), 1), HOLE_FILL_CELLS);
}

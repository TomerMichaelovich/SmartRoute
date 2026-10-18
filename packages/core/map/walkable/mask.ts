import type { GeoPoint } from "../../domain/value-objects/geo-point";

/**
 * Walkable-floor grid laid exactly over a store's map image: `cols` x `rows` cells, each cell
 * covering mapWidth/cols x mapHeight/rows image pixels (fractional is fine). data[row * cols + col]
 * is 1 for walkable floor, 0 for blocked (shelf, fridge, checkout, wall, outside the store).
 */
export interface WalkableMask {
  cols: number;
  rows: number;
  data: Uint8Array;
}

/** JSON-friendly form saved per store: run lengths alternating blocked, walkable, blocked, ... */
export interface StoredWalkableMask {
  cols: number;
  rows: number;
  rle: number[];
}

/** Grids are ~TARGET_LONG_SIDE_CELLS cells on the image's long side, whatever its pixel size. */
export const TARGET_LONG_SIDE_CELLS = 400;
/** Upper bound on cells accepted from a client, so a bogus payload can't exhaust server memory. */
export const MAX_MASK_CELLS = 600 * 600;

export function gridSizeFor(width: number, height: number): { cols: number; rows: number } {
  const longSide = Math.max(width, height);
  const cellPx = Math.max(2, Math.round(longSide / TARGET_LONG_SIDE_CELLS));
  return {
    cols: Math.max(1, Math.round(width / cellPx)),
    rows: Math.max(1, Math.round(height / cellPx)),
  };
}

export function createMask(cols: number, rows: number): WalkableMask {
  return { cols, rows, data: new Uint8Array(cols * rows) };
}

export function cloneMask(mask: WalkableMask): WalkableMask {
  return { cols: mask.cols, rows: mask.rows, data: mask.data.slice() };
}

export function encodeRle(mask: WalkableMask): StoredWalkableMask {
  const rle: number[] = [];
  let current = 0;
  let run = 0;
  for (const value of mask.data) {
    if (value === current) {
      run++;
    } else {
      rle.push(run);
      current = value;
      run = 1;
    }
  }
  rle.push(run);
  return { cols: mask.cols, rows: mask.rows, rle };
}

/** Throws on a payload whose runs don't exactly fill cols x rows. */
export function decodeRle(stored: StoredWalkableMask): WalkableMask {
  const { cols, rows, rle } = stored;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols * rows > MAX_MASK_CELLS) {
    throw new Error("Invalid walkable mask size");
  }
  const mask = createMask(cols, rows);
  let offset = 0;
  let value = 0;
  for (const run of rle) {
    if (!Number.isInteger(run) || run < 0 || offset + run > mask.data.length) {
      throw new Error("Invalid walkable mask runs");
    }
    if (value === 1) mask.data.fill(1, offset, offset + run);
    offset += run;
    value = 1 - value;
  }
  if (offset !== mask.data.length) throw new Error("Invalid walkable mask runs");
  return mask;
}

export function isWalkable(mask: WalkableMask, row: number, col: number): boolean {
  return row >= 0 && row < mask.rows && col >= 0 && col < mask.cols && mask.data[row * mask.cols + col] === 1;
}

/** Center of a cell, as a normalized 0-1 map position. */
export function cellToNormalized(mask: { cols: number; rows: number }, row: number, col: number): GeoPoint {
  return { x: (col + 0.5) / mask.cols, y: (row + 0.5) / mask.rows };
}

export function normalizedToCell(mask: { cols: number; rows: number }, point: GeoPoint): { row: number; col: number } {
  return {
    row: Math.min(mask.rows - 1, Math.max(0, Math.floor(point.y * mask.rows))),
    col: Math.min(mask.cols - 1, Math.max(0, Math.floor(point.x * mask.cols))),
  };
}

/** Sets every cell within `radius` cells of (row, col) to `value` - the admin's correction brush. */
export function paintCircle(mask: WalkableMask, row: number, col: number, radius: number, value: 0 | 1): void {
  const r = Math.max(0, radius);
  for (let y = Math.floor(row - r); y <= Math.ceil(row + r); y++) {
    if (y < 0 || y >= mask.rows) continue;
    for (let x = Math.floor(col - r); x <= Math.ceil(col + r); x++) {
      if (x < 0 || x >= mask.cols) continue;
      if ((y - row) ** 2 + (x - col) ** 2 <= r * r + 0.25) mask.data[y * mask.cols + x] = value;
    }
  }
}

/** Paints the straight stroke between two brush positions, so a fast drag leaves no gaps. */
export function paintStroke(
  mask: WalkableMask,
  from: { row: number; col: number },
  to: { row: number; col: number },
  radius: number,
  value: 0 | 1,
): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.row - from.row, to.col - from.col)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    paintCircle(mask, from.row + (to.row - from.row) * t, from.col + (to.col - from.col) * t, radius, value);
  }
}

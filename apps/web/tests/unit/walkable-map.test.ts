import { describe, expect, it } from "vitest";
import { buildGraph } from "@smartroute/core/application/routing/graph-builder";
import { dijkstra } from "@smartroute/core/application/routing/dijkstra";
import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import { detectFloor } from "@smartroute/core/map/walkable/detect-floor";
import { type NavGraphAnchor, generateNavGraph } from "@smartroute/core/map/walkable/generate-graph";
import {
  type WalkableMask,
  createMask,
  decodeRle,
  encodeRle,
  gridSizeFor,
  isWalkable,
  normalizedToCell,
} from "@smartroute/core/map/walkable/mask";

/** Mask from rows of "." (walkable) / "#" (blocked). */
function maskFrom(rows: string[]): WalkableMask {
  const mask = createMask(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => (mask.data[y * mask.cols + x] = ch === "." ? 1 : 0)));
  return mask;
}

/** 120x80-cell store: walls, two long shelves (three aisles), open floor at the bottom. */
function storeMask(): WalkableMask {
  const cols = 120;
  const rows = 80;
  const mask = createMask(cols, rows);
  for (let y = 2; y < rows - 2; y++) {
    for (let x = 2; x < cols - 2; x++) {
      const onShelf = y >= 10 && y < 45 && ((x >= 35 && x < 42) || (x >= 75 && x < 82));
      mask.data[y * cols + x] = onShelf ? 0 : 1;
    }
  }
  return mask;
}

const at = (mask: WalkableMask, x: number, y: number) => ({ x: (x + 0.5) / mask.cols, y: (y + 0.5) / mask.rows });

describe("walkable mask encoding", () => {
  it("round-trips through RLE", () => {
    const mask = storeMask();
    const decoded = decodeRle(encodeRle(mask));
    expect(decoded.cols).toBe(mask.cols);
    expect(decoded.rows).toBe(mask.rows);
    expect(Array.from(decoded.data)).toEqual(Array.from(mask.data));
  });

  it("rejects runs that don't fill the grid", () => {
    expect(() => decodeRle({ cols: 4, rows: 4, rle: [3, 4] })).toThrow();
    expect(() => decodeRle({ cols: 4, rows: 4, rle: [10, 10] })).toThrow();
    expect(() => decodeRle({ cols: 100000, rows: 100000, rle: [1e10] })).toThrow();
  });

  it("sizes grids to ~400 cells on the long side", () => {
    expect(gridSizeFor(1578, 985)).toEqual({ cols: 395, rows: 246 });
    expect(gridSizeFor(800, 800).cols).toBe(400);
  });
});

describe("detectFloor", () => {
  // 240x160 px: white page, dark wall ring, beige floor, two "shelves" of noisy product colors.
  const width = 240;
  const height = 160;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let noise = 7;
  const random = () => ((noise = (noise * 1103515245 + 12345) % 2147483648) / 2147483648) * 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= 20 && x < 220 && y >= 20 && y < 140;
      const wall = inside && (x < 26 || x >= 214 || y < 26 || y >= 134);
      const shelf = inside && !wall && y >= 45 && y < 115 && ((x >= 70 && x < 90) || (x >= 150 && x < 170));
      const tileLine = (x % 16 === 0 || y % 16 === 0) && inside;
      let rgb: [number, number, number];
      if (!inside) rgb = [242, 242, 242];
      else if (wall) rgb = [90, 80, 75];
      else if (shelf) rgb = [random(), random(), random()];
      else if (tileLine) rgb = [190, 180, 165];
      else rgb = [216, 205, 188];
      pixels.set([...rgb, 255], (y * width + x) * 4);
    }
  }
  const mask = detectFloor(pixels, width, height, { x: 120 / width, y: 30 / height }, { cols: 120, rows: 80 });
  const cellOf = (x: number, y: number) => normalizedToCell(mask, { x: x / width, y: y / height });
  const walkableAt = (x: number, y: number) => {
    const c = cellOf(x, y);
    return isWalkable(mask, c.row, c.col);
  };

  it("marks the tiled floor walkable, grout lines included", () => {
    expect(walkableAt(120, 30)).toBe(true);
    expect(walkableAt(48, 80)).toBe(true);
    expect(walkableAt(112, 80)).toBe(true); // on a tile line (x % 16 === 0)
    expect(walkableAt(200, 125)).toBe(true);
  });

  it("blocks shelves, walls and the page outside the store", () => {
    expect(walkableAt(80, 80)).toBe(false);
    expect(walkableAt(160, 80)).toBe(false);
    expect(walkableAt(22, 80)).toBe(false);
    expect(walkableAt(5, 5)).toBe(false);
  });
});

describe("generateNavGraph", () => {
  function toMapGraph(mask: WalkableMask, anchors: NavGraphAnchor[]) {
    const graph = generateNavGraph(mask, anchors);
    const nodes: MapNode[] = [
      ...anchors.map((a) => ({ id: a.id, storeId: "s", type: "department" as const, label: a.id, position: a.position })),
      ...graph.waypoints.map((w) => ({ id: w.key, storeId: "s", type: "waypoint" as const, label: "", position: w.position })),
    ];
    const edges: MapEdge[] = graph.edges.map((e, i) => ({
      id: `e${i}`,
      storeId: "s",
      fromNodeId: e.from,
      toNodeId: e.to,
      bidirectional: true,
    }));
    return { graph, nodes, edges };
  }

  it("builds one connected graph that reaches departments sitting on shelves", () => {
    const mask = storeMask();
    const anchors: NavGraphAnchor[] = [
      { id: "entrance", position: at(mask, 10, 75), isEntrance: true },
      { id: "on-shelf-dept", position: at(mask, 38, 25) },
      { id: "far-dept", position: at(mask, 110, 15) },
      { id: "checkout", position: at(mask, 60, 70) },
    ];
    const { graph, nodes, edges } = toMapGraph(mask, anchors);

    expect(graph.unreachableAnchorIds).toEqual([]);
    expect(graph.waypoints.length).toBeGreaterThan(10);
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      expect(ids.has(e.fromNodeId)).toBe(true);
      expect(ids.has(e.toNodeId)).toBe(true);
    }
    for (const w of graph.waypoints) {
      const c = normalizedToCell(mask, w.position);
      expect(isWalkable(mask, c.row, c.col)).toBe(true);
    }

    const routing = buildGraph(nodes, edges, 1200, 800);
    const fromEntrance = dijkstra(routing, "entrance");
    for (const id of ["on-shelf-dept", "far-dept", "checkout"]) {
      expect(Number.isFinite(fromEntrance.distances.get(id))).toBe(true);
    }
    // Walking around the shelf, not through it: longer than the straight line.
    const straight = Math.hypot((38 - 10) * 10, (25 - 75) * 10);
    expect(fromEntrance.distances.get("on-shelf-dept")!).toBeGreaterThan(straight);
  });

  it("reports anchors the entrance can't reach", () => {
    const mask = maskFrom([
      "############################",
      "#..........#################",
      "#..........#################",
      "#..........#######.........#",
      "#..........#######.........#",
      "#..........#######.........#",
      "#..........#######.........#",
      "############################",
    ]);
    const graph = generateNavGraph(
      mask,
      [
        { id: "entrance", position: at(mask, 2, 5), isEntrance: true },
        { id: "sealed-room", position: at(mask, 23, 5) },
      ],
      { maxSegmentCells: 4, spurCells: 2, mergeCells: 1 },
    );
    expect(graph.unreachableAnchorIds).toEqual(["sealed-room"]);
  });
});

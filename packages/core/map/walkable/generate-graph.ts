import type { GeoPoint } from "../../domain/value-objects/geo-point";
import { type WalkableMask, cellToNormalized, normalizedToCell } from "./mask";
import { NEIGHBORS_4, distanceToBlocked, erode } from "./morphology";
import { skeletonize } from "./skeleton";

/** An admin-placed node the generated graph must reach: a department, the entrance, a checkout. */
export interface NavGraphAnchor {
  id: string;
  position: GeoPoint;
  isEntrance?: boolean;
}

export interface GeneratedWaypoint {
  key: string;
  position: GeoPoint;
}

/** Endpoints are a GeneratedWaypoint.key or a NavGraphAnchor.id. */
export interface GeneratedEdge {
  from: string;
  to: string;
}

export interface NavGraph {
  waypoints: GeneratedWaypoint[];
  edges: GeneratedEdge[];
  /** Anchors the entrance can't reach through the generated graph (or with no floor nearby). */
  unreachableAnchorIds: string[];
}

/** All distances are in grid cells (the grid is ~400 cells on the image's long side). */
export interface NavGraphOptions {
  /** A waypoint at least every this many cells along an aisle. */
  maxSegmentCells: number;
  /** Centerline dead-ends shorter than this are thinning artifacts and get pruned. */
  spurCells: number;
  /** Waypoints closer than this are merged into one. */
  mergeCells: number;
  /** Straight-line shortcuts must keep this far from shelves/walls. */
  clearanceCells: number;
  /** Max length of a straight-line shortcut between nearby waypoints. */
  shortcutCells: number;
  /** Floor at least this far from anything blocked is "open area" and gets a lattice of waypoints. */
  openAreaCells: number;
  latticeCells: number;
  /** How far an anchor sitting on a shelf may be from the nearest floor. */
  anchorSearchCells: number;
  /** Each anchor is linked to up to this many nearby waypoints. */
  anchorLinks: number;
}

export const DEFAULT_NAV_GRAPH_OPTIONS: NavGraphOptions = {
  maxSegmentCells: 15,
  spurCells: 8,
  mergeCells: 4,
  clearanceCells: 2,
  shortcutCells: 25,
  openAreaCells: 12,
  latticeCells: 15,
  anchorSearchCells: 25,
  anchorLinks: 2,
};

interface Cell {
  y: number;
  x: number;
}

const NEIGHBORS_8: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

/**
 * Turns a walkable-floor mask into a navigation graph for the existing router:
 *  1. Thin the floor to its centerline (one line down the middle of every aisle).
 *  2. Prune short dead-end whiskers, then walk the centerline between its junctions/ends,
 *     simplifying each run (Douglas-Peucker) and dropping a waypoint at every bend and at least
 *     every maxSegmentCells.
 *  3. Wide open areas (e.g. the space around the checkouts) get a lattice of extra waypoints, since a
 *     single centerline through them would force detours.
 *  4. Nearby waypoints with a clear straight line between them get a shortcut edge.
 *  5. Each anchor (department/entrance/checkout - usually drawn on top of a shelf) is linked to the
 *     nearest waypoints it can see from the closest floor cell.
 *  6. Waypoint islands nobody can use are dropped, and anchors the entrance can't reach are reported.
 */
export function generateNavGraph(
  mask: WalkableMask,
  anchors: NavGraphAnchor[],
  partialOptions: Partial<NavGraphOptions> = {},
): NavGraph {
  const opts = { ...DEFAULT_NAV_GRAPH_OPTIONS, ...partialOptions };
  const { cols, rows } = mask;
  const sk = skeletonize(mask);
  pruneSpurs(sk, cols, rows, opts.spurCells);

  // ---- trace the centerline into waypoints/edges
  const points: Cell[] = [];
  const pointIndexByCell = new Map<number, number>();
  const edgeSet = new Set<string>();
  const pointAt = (c: Cell) => {
    const key = c.y * cols + c.x;
    let index = pointIndexByCell.get(key);
    if (index === undefined) {
      index = points.length;
      points.push(c);
      pointIndexByCell.set(key, index);
    }
    return index;
  };
  const addEdge = (a: number, b: number) => {
    if (a !== b) edgeSet.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  };

  const neighbors = (i: number): number[] => {
    const y = Math.floor(i / cols);
    const x = i % cols;
    const out: number[] = [];
    for (const [dy, dx] of NEIGHBORS_8) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && sk[ny * cols + nx]) out.push(ny * cols + nx);
    }
    return out;
  };

  const isKey = new Uint8Array(cols * rows);
  for (let i = 0; i < sk.length; i++) if (sk[i] && neighbors(i).length !== 2) isKey[i] = 1;
  const visited = new Uint8Array(cols * rows);
  const usedStarts = new Set<string>();

  const traceFrom = (start: number) => {
    visited[start] = 1;
    for (const first of neighbors(start)) {
      if (usedStarts.has(`${start}>${first}`)) continue;
      const path = [start, first];
      const onPath = new Set(path);
      let prev = start;
      let cur = first;
      visited[cur] = 1;
      while (!isKey[cur]) {
        const next = neighbors(cur).find((n) => n !== prev && (!onPath.has(n) || isKey[n]));
        if (next === undefined) break;
        prev = cur;
        cur = next;
        path.push(cur);
        onPath.add(cur);
        visited[cur] = 1;
      }
      usedStarts.add(`${start}>${first}`);
      usedStarts.add(`${cur}>${path[path.length - 2]}`);

      const cells = path.map((i) => ({ y: Math.floor(i / cols), x: i % cols }));
      const simplified = douglasPeucker(cells, 1.5);
      let last = pointAt(simplified[0]);
      for (let k = 1; k < simplified.length; k++) {
        const a = points[last];
        const b = simplified[k];
        const pieces = Math.max(1, Math.round(Math.hypot(b.y - a.y, b.x - a.x) / opts.maxSegmentCells));
        for (let p = 1; p <= pieces; p++) {
          const next = pointAt({
            y: Math.round(a.y + ((b.y - a.y) * p) / pieces),
            x: Math.round(a.x + ((b.x - a.x) * p) / pieces),
          });
          addEdge(last, next);
          last = next;
        }
      }
    }
  };

  for (let i = 0; i < sk.length; i++) if (isKey[i]) traceFrom(i);
  // Closed loops with no junction on them (a ring around a lone island) have no key cell yet.
  for (let i = 0; i < sk.length; i++) {
    if (sk[i] && !visited[i]) {
      isKey[i] = 1;
      traceFrom(i);
    }
  }

  // ---- merge waypoints that ended up practically on top of each other
  const parent = points.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].y - points[j].y, points[i].x - points[j].x) < opts.mergeCells) {
        parent[find(j)] = find(i);
      }
    }
  }
  const nodes: Cell[] = [];
  const nodeOfRoot = new Map<number, number>();
  for (let i = 0; i < points.length; i++) {
    const root = find(i);
    if (!nodeOfRoot.has(root)) {
      nodeOfRoot.set(root, nodes.length);
      nodes.push(points[root]);
    }
  }
  const edges = new Set<string>();
  const link = (a: number, b: number) => {
    if (a !== b) edges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  };
  for (const key of edgeSet) {
    const [a, b] = key.split("|").map(Number);
    link(nodeOfRoot.get(find(a))!, nodeOfRoot.get(find(b))!);
  }

  // ---- lattice over wide open floor
  const dist = distanceToBlocked(mask);
  const distAt = (c: Cell) => dist[c.y * cols + c.x];
  const half = Math.floor(opts.latticeCells / 2);
  const minGap = opts.latticeCells / 2;
  const skeletonNodeCount = nodes.length;
  for (let y = half; y < rows; y += opts.latticeCells) {
    for (let x = half; x < cols; x += opts.latticeCells) {
      if (dist[y * cols + x] < opts.openAreaCells) continue;
      let tooClose = false;
      for (let k = 0; k < skeletonNodeCount && !tooClose; k++) {
        if (Math.hypot(nodes[k].y - y, nodes[k].x - x) < minGap) tooClose = true;
      }
      if (!tooClose) nodes.push({ y, x });
    }
  }

  // ---- straight-line shortcuts between nearby waypoints
  const safe = erode(mask, opts.clearanceCells);
  const openPairCells = Math.ceil(opts.openAreaCells * 0.66);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].y - nodes[j].y, nodes[i].x - nodes[j].x);
      const bothOpen = distAt(nodes[i]) >= openPairCells && distAt(nodes[j]) >= openPairCells;
      const radius = bothOpen ? opts.latticeCells * 1.5 : opts.shortcutCells;
      if (d > radius || edges.has(`${i}|${j}`)) continue;
      if (lineOfSight(safe, nodes[i], nodes[j])) link(i, j);
    }
  }

  // ---- link anchors to the graph
  const nodeIndexByCell = new Map<number, number>();
  nodes.forEach((c, i) => nodeIndexByCell.set(c.y * cols + c.x, i));
  const anchorLinks: { anchorId: string; nodeIndex: number }[] = [];
  const noFloorAnchors = new Set<string>();

  for (const anchor of anchors) {
    const { row, col } = normalizedToCell(mask, anchor.position);
    const entry = nearestFloorCell(mask, { y: row, x: col }, opts.anchorSearchCells);
    if (!entry) {
      noFloorAnchors.add(anchor.id);
      continue;
    }
    const candidates = nodesByWalkingOrder(mask, entry, nodeIndexByCell, 8);
    const picked = candidates.filter((i) => lineOfSight(mask, entry, nodes[i])).slice(0, opts.anchorLinks);
    if (picked.length === 0 && candidates.length > 0) picked.push(candidates[0]);
    if (picked.length === 0) {
      noFloorAnchors.add(anchor.id);
      continue;
    }

    // An anchor drawn on a shelf first steps onto the floor at its own waypoint, so routes reach it
    // via the aisle instead of cutting through the shelf at an angle.
    const stepsOff = Math.hypot(entry.y - row, entry.x - col) > 1.5;
    let target: number;
    if (stepsOff) {
      const existing = nodeIndexByCell.get(entry.y * cols + entry.x);
      target = existing ?? nodes.push(entry) - 1;
      nodeIndexByCell.set(entry.y * cols + entry.x, target);
      for (const i of picked) link(target, i);
      anchorLinks.push({ anchorId: anchor.id, nodeIndex: target });
    } else {
      for (const i of picked) anchorLinks.push({ anchorId: anchor.id, nodeIndex: i });
    }
  }

  // ---- connectivity: keep only what someone can walk to
  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };
  const nodeKey = (i: number) => `w${i}`;
  for (const key of edges) {
    const [a, b] = key.split("|").map(Number);
    connect(nodeKey(a), nodeKey(b));
  }
  for (const l of anchorLinks) connect(l.anchorId, nodeKey(l.nodeIndex));

  const components = new Map<string, number>();
  let componentCount = 0;
  const componentSize: number[] = [];
  for (const start of adjacency.keys()) {
    if (components.has(start)) continue;
    const id = componentCount++;
    componentSize[id] = 0;
    const stack = [start];
    components.set(start, id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      componentSize[id]++;
      for (const next of adjacency.get(cur)!) {
        if (!components.has(next)) {
          components.set(next, id);
          stack.push(next);
        }
      }
    }
  }

  const entrance = anchors.find((a) => a.isEntrance && components.has(a.id));
  const mainComponent = entrance
    ? components.get(entrance.id)!
    : componentSize.reduce((best, size, id) => (size > (componentSize[best] ?? -1) ? id : best), 0);
  const keptComponents = new Set<number>([mainComponent]);
  for (const a of anchors) if (components.has(a.id)) keptComponents.add(components.get(a.id)!);

  const waypoints: GeneratedWaypoint[] = [];
  nodes.forEach((c, i) => {
    const component = components.get(nodeKey(i));
    if (component !== undefined && keptComponents.has(component)) {
      waypoints.push({ key: nodeKey(i), position: cellToNormalized(mask, c.y, c.x) });
    }
  });
  const kept = new Set(waypoints.map((w) => w.key));
  const outEdges: GeneratedEdge[] = [];
  for (const key of edges) {
    const [a, b] = key.split("|").map(Number);
    if (kept.has(nodeKey(a)) && kept.has(nodeKey(b))) outEdges.push({ from: nodeKey(a), to: nodeKey(b) });
  }
  for (const l of anchorLinks) outEdges.push({ from: l.anchorId, to: nodeKey(l.nodeIndex) });

  const unreachableAnchorIds = anchors
    .filter((a) => noFloorAnchors.has(a.id) || components.get(a.id) !== mainComponent)
    .map((a) => a.id);

  return { waypoints, edges: outEdges, unreachableAnchorIds };
}

/** Removes centerline dead-ends of at most maxLength cells that hang off a junction. */
function pruneSpurs(sk: Uint8Array, cols: number, rows: number, maxLength: number): void {
  const degree = (i: number) => {
    const y = Math.floor(i / cols);
    const x = i % cols;
    let d = 0;
    for (const [dy, dx] of NEIGHBORS_8) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && sk[ny * cols + nx]) d++;
    }
    return d;
  };
  const neighborList = (i: number) => {
    const y = Math.floor(i / cols);
    const x = i % cols;
    const out: number[] = [];
    for (const [dy, dx] of NEIGHBORS_8) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && sk[ny * cols + nx]) out.push(ny * cols + nx);
    }
    return out;
  };

  for (let pass = 0; pass < 3; pass++) {
    const ends: number[] = [];
    for (let i = 0; i < sk.length; i++) if (sk[i] && degree(i) === 1) ends.push(i);
    for (const end of ends) {
      if (!sk[end]) continue;
      const path = [end];
      let prev = -1;
      let cur = end;
      while (path.length <= maxLength) {
        if (cur !== end && degree(cur) > 2) break;
        const next = neighborList(cur).filter((n) => n !== prev && !path.includes(n));
        if (next.length !== 1) break;
        prev = cur;
        cur = next[0];
        path.push(cur);
      }
      if (path.length <= maxLength && cur !== end && degree(cur) > 2) {
        for (const i of path.slice(0, -1)) sk[i] = 0;
      }
    }
  }
}

function douglasPeucker(points: Cell[], epsilon: number): Cell[] {
  if (points.length < 3) return points;
  const a = points[0];
  const b = points[points.length - 1];
  const length = Math.hypot(b.y - a.y, b.x - a.x) || 1;
  let maxDistance = -1;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= epsilon) return [a, b];
  return [...douglasPeucker(points.slice(0, index + 1), epsilon).slice(0, -1), ...douglasPeucker(points.slice(index), epsilon)];
}

function lineOfSight(mask: WalkableMask, a: Cell, b: Cell): boolean {
  const steps = Math.max(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 2;
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const y = Math.round(a.y + (b.y - a.y) * t);
    const x = Math.round(a.x + (b.x - a.x) * t);
    if (mask.data[y * mask.cols + x] !== 1) return false;
  }
  return true;
}

/** Nearest walkable cell (by grid steps), searching through blocked cells up to maxCells away. */
function nearestFloorCell(mask: WalkableMask, start: Cell, maxCells: number): Cell | null {
  const { cols, rows } = mask;
  const seen = new Uint8Array(cols * rows);
  const queue: Cell[] = [start];
  seen[start.y * cols + start.x] = 1;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    if (mask.data[c.y * cols + c.x] === 1) return c;
    for (const [dy, dx] of NEIGHBORS_4) {
      const ny = c.y + dy;
      const nx = c.x + dx;
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols || seen[ny * cols + nx]) continue;
      if (Math.max(Math.abs(ny - start.y), Math.abs(nx - start.x)) > maxCells) continue;
      seen[ny * cols + nx] = 1;
      queue.push({ y: ny, x: nx });
    }
  }
  return null;
}

/** Graph nodes in the order a walk across the floor from `start` reaches them (first `limit`). */
function nodesByWalkingOrder(
  mask: WalkableMask,
  start: Cell,
  nodeIndexByCell: Map<number, number>,
  limit: number,
): number[] {
  const { cols, rows } = mask;
  const seen = new Uint8Array(cols * rows);
  const queue: number[] = [start.y * cols + start.x];
  seen[queue[0]] = 1;
  const found: number[] = [];
  for (let head = 0; head < queue.length && found.length < limit; head++) {
    const i = queue[head];
    const node = nodeIndexByCell.get(i);
    if (node !== undefined) found.push(node);
    const y = Math.floor(i / cols);
    const x = i % cols;
    for (const [dy, dx] of NEIGHBORS_4) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
      const ni = ny * cols + nx;
      if (!seen[ni] && mask.data[ni] === 1) {
        seen[ni] = 1;
        queue.push(ni);
      }
    }
  }
  return found;
}

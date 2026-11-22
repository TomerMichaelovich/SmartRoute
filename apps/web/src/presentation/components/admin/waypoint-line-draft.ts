import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";

/**
 * The map editor's waypoint-line draft: several straight lines drawn one after another and
 * created together with one "create" press. Positions are normalized 0-1 map coordinates.
 *
 * A line can start from any point of a line already drawn: from one of its ends, or from one of
 * the points between them - that splits the line there into two, so the point becomes a real
 * end both share and the new line joins the corridor at it.
 */

export interface DraftPoint {
  key: string;
  /** An existing map node this end sits on; the line joins it instead of adding a waypoint. */
  nodeId?: string;
  /** An existing map edge this new waypoint sits on; that edge gets split here when created. */
  edgeId?: string;
  x: number;
  y: number;
}

export interface DraftSegment {
  from: string;
  to: string;
  /** Waypoints evenly spaced between the two ends. */
  count: number;
}

export interface LineDraft {
  points: DraftPoint[];
  segments: DraftSegment[];
  /** The end a line is being stretched from, waiting for its other end. */
  pendingFrom: string | null;
}

export const EMPTY_LINE_DRAFT: LineDraft = { points: [], segments: [], pendingFrom: null };

type Point = { x: number; y: number };

/** The `count` points evenly spaced strictly between a and b. */
export function innerPoints(a: Point, b: Point, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

export function pointByKey(draft: LineDraft, key: string): DraftPoint | undefined {
  return draft.points.find((p) => p.key === key);
}

/** In-between points for a line this long: one per `spacing` (a fraction of map width), on every line alike. */
export function uniformCount(a: Point, b: Point, mapWidth: number, mapHeight: number, spacing: number) {
  const length = Math.hypot((b.x - a.x) * mapWidth, (b.y - a.y) * mapHeight);
  return Math.max(0, Math.round(length / (spacing * mapWidth)) - 1);
}

/** The draft with every line's point count set by its current length, so moves and splits stay on the same scale. */
export function withUniformSpacing(draft: LineDraft, mapWidth: number, mapHeight: number, spacing: number): LineDraft {
  return {
    ...draft,
    segments: draft.segments.map((s) => {
      const a = pointByKey(draft, s.from);
      const b = pointByKey(draft, s.to);
      return a && b ? { ...s, count: uniformCount(a, b, mapWidth, mapHeight, spacing) } : s;
    }),
  };
}

export type DraftHit = { kind: "end"; key: string } | { kind: "inner"; segment: number; index: number };

/**
 * The draft point within `tolerance` map units of `at`, if any: a line's end first, else one of
 * the points between (index counts from 1 at the segment's `from` end).
 */
export function hitDraft(draft: LineDraft, at: Point, tolerance: number, mapWidth: number, mapHeight: number): DraftHit | null {
  const distance = (p: Point) => Math.hypot((p.x - at.x) * mapWidth, (p.y - at.y) * mapHeight);
  let best: { hit: DraftHit; d: number } | null = null;
  for (const p of draft.points) {
    const d = distance(p);
    if (d <= tolerance && (!best || d < best.d)) best = { hit: { kind: "end", key: p.key }, d };
  }
  if (best) return best.hit;
  draft.segments.forEach((s, segment) => {
    const a = pointByKey(draft, s.from);
    const b = pointByKey(draft, s.to);
    if (!a || !b) return;
    innerPoints(a, b, s.count).forEach((p, i) => {
      const d = distance(p);
      if (d <= tolerance && (!best || d < best.d)) best = { hit: { kind: "inner", segment, index: i + 1 }, d };
    });
  });
  return best ? (best as { hit: DraftHit }).hit : null;
}

/** Turns in-between point `index` of a segment into a shared end, splitting the segment in two there. */
export function splitAt(draft: LineDraft, segment: number, index: number, newKey: string): { draft: LineDraft; key: string } {
  const s = draft.segments[segment];
  const a = pointByKey(draft, s.from)!;
  const b = pointByKey(draft, s.to)!;
  const position = innerPoints(a, b, s.count)[index - 1];
  const segments = [...draft.segments];
  segments.splice(
    segment,
    1,
    { from: s.from, to: newKey, count: index - 1 },
    { from: newKey, to: s.to, count: s.count - index },
  );
  return { draft: { ...draft, points: [...draft.points, { key: newKey, ...position }], segments }, key: newKey };
}

/**
 * The point on segment a-b nearest to `p`: its position, how far along (t, 0 at a to 1 at b),
 * and its distance from `p` in map units.
 */
export function nearestOnSegment(a: Point, b: Point, p: Point, mapWidth: number, mapHeight: number) {
  const ax = a.x * mapWidth;
  const ay = a.y * mapHeight;
  const dx = b.x * mapWidth - ax;
  const dy = b.y * mapHeight - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x * mapWidth - ax) * dx + (p.y * mapHeight - ay) * dy) / lengthSq));
  const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const distance = Math.hypot((point.x - p.x) * mapWidth, (point.y - p.y) * mapHeight);
  return { t, point, distance };
}

/** The drafted line passing within `tolerance` map units of `at` (strictly between its ends), if any. */
export function hitDraftLine(
  draft: LineDraft,
  at: Point,
  tolerance: number,
  mapWidth: number,
  mapHeight: number,
): { segment: number; t: number } | null {
  let best: { segment: number; t: number; distance: number } | null = null;
  draft.segments.forEach((s, segment) => {
    const a = pointByKey(draft, s.from);
    const b = pointByKey(draft, s.to);
    if (!a || !b) return;
    const near = nearestOnSegment(a, b, at, mapWidth, mapHeight);
    if (near.t <= 0 || near.t >= 1 || near.distance > tolerance) return;
    if (!best || near.distance < best.distance) best = { segment, t: near.t, distance: near.distance };
  });
  return best ? { segment: (best as { segment: number }).segment, t: (best as { t: number }).t } : null;
}

/**
 * Puts a new shared end at fraction `t` along a drafted line, splitting it in two there. The
 * line's in-between points are shared out by where they fell: those before `t` go to the first
 * part, the rest to the second.
 */
export function splitAtPosition(draft: LineDraft, segment: number, t: number, newKey: string): { draft: LineDraft; key: string } {
  const s = draft.segments[segment];
  const a = pointByKey(draft, s.from)!;
  const b = pointByKey(draft, s.to)!;
  const position = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  let before = 0;
  for (let i = 1; i <= s.count; i++) if (i / (s.count + 1) < t) before++;
  const segments = [...draft.segments];
  segments.splice(
    segment,
    1,
    { from: s.from, to: newKey, count: before },
    { from: newKey, to: s.to, count: s.count - before },
  );
  return { draft: { ...draft, points: [...draft.points, { key: newKey, ...position }], segments }, key: newKey };
}

/** Adds an end at a spot (or on a node - reusing the draft's end already on that node). */
export function addPoint(draft: LineDraft, point: Omit<DraftPoint, "key">, newKey: string): { draft: LineDraft; key: string } {
  const existing = point.nodeId ? draft.points.find((p) => p.nodeId === point.nodeId) : undefined;
  if (existing) return { draft, key: existing.key };
  return { draft: { ...draft, points: [...draft.points, { key: newKey, ...point }] }, key: newKey };
}

/**
 * Unhooks the draft's end from a map node: it stays where it is (its lines don't move) but
 * becomes a plain new waypoint there instead of joining the node.
 */
export function detachFromNode(draft: LineDraft, nodeId: string): LineDraft {
  return {
    ...draft,
    points: draft.points.map((p) => (p.nodeId === nodeId ? { key: p.key, x: p.x, y: p.y } : p)),
  };
}

/** Appends the line from → to (ignored when both are the same end) and stops stretching. */
export function connect(draft: LineDraft, from: string, to: string, count: number): LineDraft {
  if (from === to) return draft;
  return { ...draft, segments: [...draft.segments, { from, to, count }], pendingFrom: null };
}

/** Stops stretching the current line, dropping an end it had added that no line uses. */
export function cancelPending(draft: LineDraft): LineDraft {
  const used = new Set(draft.segments.flatMap((s) => [s.from, s.to]));
  return { ...draft, points: draft.points.filter((p) => used.has(p.key)), pendingFrom: null };
}

/**
 * Shifts one drafted line - both its ends - by (dx, dy), parallel to itself; lines sharing those
 * ends stretch to stay joined. An end that sat on a map node or edge comes loose and moves too
 * (it becomes a plain new waypoint).
 */
export function moveSegment(draft: LineDraft, segment: number, dx: number, dy: number): LineDraft {
  const s = draft.segments[segment];
  if (!s) return draft;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  return {
    ...draft,
    points: draft.points.map((p) =>
      p.key === s.from || p.key === s.to ? { key: p.key, x: clamp01(p.x + dx), y: clamp01(p.y + dy) } : p,
    ),
  };
}

/**
 * Ctrl+Z while drawing: the line just drawn goes and stretching resumes from where it started; with
 * no such line, the stretch is dropped, and with none of that either, the last line.
 */
export function undoLastLineStep(draft: LineDraft): LineDraft {
  const last = draft.segments.at(-1);
  if (draft.pendingFrom && last?.to === draft.pendingFrom) {
    const segments = draft.segments.slice(0, -1);
    const used = new Set([...segments.flatMap((s) => [s.from, s.to]), last.from]);
    return { points: draft.points.filter((p) => used.has(p.key)), segments, pendingFrom: last.from };
  }
  return draft.pendingFrom ? cancelPending(draft) : removeLastSegment(draft);
}

/** Drops the last line, and any end no line uses any more. */
export function removeLastSegment(draft: LineDraft): LineDraft {
  const segments = draft.segments.slice(0, -1);
  const used = new Set(segments.flatMap((s) => [s.from, s.to]));
  return { points: draft.points.filter((p) => used.has(p.key)), segments, pendingFrom: null };
}

/** How far along a-b it crosses c-d (0 to 1), when they cross strictly inside both. */
function crossingAlong(a: Point, b: Point, c: Point, d: Point, mapWidth: number, mapHeight: number): number | null {
  const rx = (b.x - a.x) * mapWidth;
  const ry = (b.y - a.y) * mapHeight;
  const sx = (d.x - c.x) * mapWidth;
  const sy = (d.y - c.y) * mapHeight;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-9) return null;
  const qx = (c.x - a.x) * mapWidth;
  const qy = (c.y - a.y) * mapHeight;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : null;
}

/**
 * Joins the drafted lines to the walking graph wherever they touch it, however they got there
 * (arrow keys let go of what an end was attached to). An end within `tolerance` map units of a
 * waypoint or corridor attaches to it, and a line running over a waypoint or across a corridor is
 * split there. Departments, entrances and checkouts are only ever joined by clicking them.
 * Point counts are left for withUniformSpacing to set from the new lengths.
 */
export function joinTouching(
  draft: LineDraft,
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  mapWidth: number,
  mapHeight: number,
  tolerance: number,
  newKey: () => string = () => crypto.randomUUID(),
): LineDraft {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const waypoints = nodes.filter((n) => n.type === "waypoint");
  const corridors = edges.flatMap((e) => {
    const a = nodeById.get(e.fromNodeId);
    const b = nodeById.get(e.toNodeId);
    return a?.type === "waypoint" && b?.type === "waypoint" ? [{ id: e.id, a: a.position, b: b.position }] : [];
  });
  const walkedBothWays = new Set(
    edges.filter((e) => e.bidirectional).flatMap((e) => [`${e.fromNodeId}|${e.toNodeId}`, `${e.toNodeId}|${e.fromNodeId}`]),
  );
  const gap = (p: Point, q: Point) => Math.hypot((p.x - q.x) * mapWidth, (p.y - q.y) * mapHeight);

  function attach(p: DraftPoint): DraftPoint {
    if (p.nodeId || p.edgeId) return p;
    let waypoint: { node: MapNode; d: number } | null = null;
    for (const node of waypoints) {
      const d = gap(node.position, p);
      if (d <= tolerance && (!waypoint || d < waypoint.d)) waypoint = { node, d };
    }
    if (waypoint) return { key: p.key, nodeId: waypoint.node.id, ...waypoint.node.position };
    let corridor: { edgeId: string; point: Point; d: number } | null = null;
    for (const c of corridors) {
      const near = nearestOnSegment(c.a, c.b, p, mapWidth, mapHeight);
      if (near.t <= 0 || near.t >= 1 || near.distance > tolerance) continue;
      if (!corridor || near.distance < corridor.d) corridor = { edgeId: c.id, point: near.point, d: near.distance };
    }
    return corridor ? { key: p.key, edgeId: corridor.edgeId, ...corridor.point } : p;
  }

  const points = draft.points.map(attach);
  const find = (key: string) => points.find((p) => p.key === key);
  /** The draft's point for this join, shared when another line already joins there. */
  function keyFor(stop: Omit<DraftPoint, "key">) {
    const existing = points.find((p) =>
      stop.nodeId ? p.nodeId === stop.nodeId : p.edgeId === stop.edgeId && gap(p, stop) <= tolerance,
    );
    if (existing) return existing.key;
    const key = newKey();
    points.push({ key, ...stop });
    return key;
  }

  const segments: DraftSegment[] = [];
  for (const segment of draft.segments) {
    const a = find(segment.from);
    const b = find(segment.to);
    if (!a || !b) continue;
    const stops: Array<{ t: number; stop: Omit<DraftPoint, "key"> }> = [];
    for (const node of waypoints) {
      if (node.id === a.nodeId || node.id === b.nodeId) continue;
      if (gap(node.position, a) <= tolerance || gap(node.position, b) <= tolerance) continue;
      const near = nearestOnSegment(a, b, node.position, mapWidth, mapHeight);
      if (near.distance <= tolerance) stops.push({ t: near.t, stop: { nodeId: node.id, ...node.position } });
    }
    for (const c of corridors) {
      const t = crossingAlong(a, b, c.a, c.b, mapWidth, mapHeight);
      if (t === null) continue;
      const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      // By a corridor's end, the waypoint there is the join; by the line's own end, that end is.
      if ([a, b, c.a, c.b].some((p) => gap(at, p) <= tolerance)) continue;
      stops.push({ t, stop: { edgeId: c.id, ...at } });
    }
    stops.sort((p, q) => p.t - q.t);
    const kept: typeof stops = [];
    for (const entry of stops) {
      const last = kept.at(-1);
      if (!last || gap(last.stop, entry.stop) > tolerance) kept.push(entry);
      else if (entry.stop.nodeId && !last.stop.nodeId) kept[kept.length - 1] = entry;
    }

    const chain = [segment.from, ...kept.map((k) => keyFor(k.stop)), segment.to];
    for (let i = 1; i < chain.length; i++) {
      const from = find(chain[i - 1])!;
      const to = find(chain[i])!;
      if (from.key === to.key) continue;
      // Laid right over an existing edge: that stretch is already walkable.
      if (from.nodeId && to.nodeId && walkedBothWays.has(`${from.nodeId}|${to.nodeId}`)) continue;
      segments.push({ from: from.key, to: to.key, count: segment.count });
    }
  }
  return { ...draft, points, segments };
}

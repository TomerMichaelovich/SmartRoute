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

/** Default number of in-between points for a line this long, about one per `spacing` of map width. */
export function suggestedCount(a: Point, b: Point, mapWidth: number, mapHeight: number, spacing: number, max: number) {
  const length = Math.hypot((b.x - a.x) * mapWidth, (b.y - a.y) * mapHeight);
  return Math.max(0, Math.min(max, Math.round(length / (spacing * mapWidth)) - 1));
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

/** Drops the last line, and any end no line uses any more. */
export function removeLastSegment(draft: LineDraft): LineDraft {
  const segments = draft.segments.slice(0, -1);
  const used = new Set(segments.flatMap((s) => [s.from, s.to]));
  return { points: draft.points.filter((p) => used.has(p.key)), segments, pendingFrom: null };
}

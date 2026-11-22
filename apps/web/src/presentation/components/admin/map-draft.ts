import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { GeoPoint } from "@smartroute/core/domain/value-objects/geo-point";
import type { MapChanges, MapNodePatch } from "@/src/infrastructure/repositories/interfaces/node-repository";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";

/**
 * The map editor's draft: edits change a copy of the map in the browser, each one a step that can
 * be undone, and only "save changes" writes the difference from the saved map.
 */
export interface MapState {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Where each of the store's video pins stands. */
  videoPositions: Record<string, GeoPoint>;
}

export interface MapHistory {
  /** The saved map the draft started from. */
  base: MapState;
  /** The states before each edit, oldest (the base) first. */
  past: MapState[];
  present: MapState;
}

/** One end of a drawn line: an existing node, or a spot for a new waypoint (on `edgeId`: splits that edge). */
export type WaypointLinePoint =
  | { key: string; nodeId: string }
  | { key: string; x: number; y: number; edgeId?: string };

/** A straight line between two ends (by key), with `count` waypoints evenly between them. */
export interface WaypointLineSegment {
  from: string;
  to: string;
  count: number;
}

const samePoint = (a: GeoPoint, b: GeoPoint) => a.x === b.x && a.y === b.y;

function sameArea(a: GeoPoint[] | undefined, b: GeoPoint[] | undefined) {
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
  return (a ?? []).every((point, i) => samePoint(point, b![i]));
}

/** What has to be written to turn the `base` map into the `draft`. */
export function diffMap(base: MapState, draft: MapState): MapChanges {
  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]));
  const draftNodeIds = new Set(draft.nodes.map((n) => n.id));
  const baseEdgeIds = new Set(base.edges.map((e) => e.id));
  const draftEdgeIds = new Set(draft.edges.map((e) => e.id));

  const createdNodes: MapNode[] = [];
  const updatedNodes: MapNodePatch[] = [];
  for (const node of draft.nodes) {
    const saved = baseNodes.get(node.id);
    if (!saved) {
      createdNodes.push(node);
      continue;
    }
    const patch: MapNodePatch = { id: node.id };
    if (node.label !== saved.label) patch.label = node.label;
    if (!samePoint(node.position, saved.position)) patch.position = node.position;
    if (!sameArea(node.area, saved.area)) patch.area = node.area ?? null;
    if (Object.keys(patch).length > 1) updatedNodes.push(patch);
  }

  const movedVideos = Object.entries(draft.videoPositions).flatMap(([id, position]) => {
    const saved = base.videoPositions[id];
    return saved && !samePoint(saved, position) ? [{ id, position }] : [];
  });

  return {
    createdNodes,
    updatedNodes,
    deletedNodeIds: base.nodes.filter((n) => !draftNodeIds.has(n.id)).map((n) => n.id),
    createdEdges: draft.edges.filter((e) => !baseEdgeIds.has(e.id)),
    deletedEdgeIds: base.edges.filter((e) => !draftEdgeIds.has(e.id)).map((e) => e.id),
    movedVideos,
  };
}

export function hasMapChanges(changes: MapChanges) {
  return (
    changes.createdNodes.length > 0 ||
    changes.updatedNodes.length > 0 ||
    changes.deletedNodeIds.length > 0 ||
    changes.createdEdges.length > 0 ||
    changes.deletedEdgeIds.length > 0 ||
    changes.movedVideos.length > 0
  );
}

/** The `saved` map with these changes on it; a change to something no longer there is dropped. */
export function applyMapChanges(saved: MapState, changes: MapChanges): MapState {
  const deletedNodes = new Set(changes.deletedNodeIds);
  const deletedEdges = new Set(changes.deletedEdgeIds);
  const patches = new Map(changes.updatedNodes.map((p) => [p.id, p]));
  const savedNodeIds = new Set(saved.nodes.map((n) => n.id));
  const savedEdgeIds = new Set(saved.edges.map((e) => e.id));

  const nodes = [
    ...saved.nodes
      .filter((n) => !deletedNodes.has(n.id))
      .map((n) => {
        const patch = patches.get(n.id);
        if (!patch) return n;
        const { area, ...fields } = patch;
        return { ...n, ...fields, ...(area !== undefined ? { area: area ?? undefined } : {}) };
      }),
    ...changes.createdNodes.filter((n) => !savedNodeIds.has(n.id)),
  ];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const bothEndsExist = (e: MapEdge) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId);
  const videoPositions = { ...saved.videoPositions };
  for (const { id, position } of changes.movedVideos) {
    if (videoPositions[id]) videoPositions[id] = position;
  }
  return {
    nodes,
    edges: [
      ...saved.edges.filter((e) => !deletedEdges.has(e.id) && bothEndsExist(e)),
      ...changes.createdEdges.filter((e) => !savedEdgeIds.has(e.id) && bothEndsExist(e)),
    ],
    videoPositions,
  };
}

/** Adds an edit as one undo step; `current` is the map the first edit of a draft starts from. */
export function pushChange(history: MapHistory | null, current: MapState, next: MapState): MapHistory | null {
  const from = history ?? { base: current, past: [], present: current };
  if (next === from.present) return history;
  return { base: from.base, past: [...from.past, from.present], present: next };
}

/** One step back; back at the saved map there is no draft any more. */
export function undoChange(history: MapHistory | null): MapHistory | null {
  if (!history || history.past.length <= 1) return null;
  return { ...history, past: history.past.slice(0, -1), present: history.past.at(-1)! };
}

/** Keeps the draft's edits, every undo step included, on a saved map that changed underneath it. */
export function rebaseHistory(history: MapHistory, saved: MapState): MapHistory {
  const move = (state: MapState) => applyMapChanges(saved, diffMap(history.base, state));
  return { base: saved, past: history.past.map(move), present: move(history.present) };
}

/** Takes these nodes (with every edge touching them) and edges off the map. */
export function removeFromMap(map: MapState, nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>): MapState {
  return {
    ...map,
    nodes: map.nodes.filter((n) => !nodeIds.has(n.id)),
    edges: map.edges.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.fromNodeId) && !nodeIds.has(e.toNodeId)),
  };
}

/**
 * The walking graph's reset: every waypoint goes, with its edges. A waypoint that products or a
 * promotion are placed on stays - it's acting as a department.
 */
export function removeWaypoints(map: MapState, referencedNodeIds: ReadonlySet<string>) {
  const waypoints = map.nodes.filter((n) => n.type === "waypoint");
  const toDelete = new Set(waypoints.filter((n) => !referencedNodeIds.has(n.id)).map((n) => n.id));
  return {
    map: removeFromMap(map, toDelete, new Set()),
    deleted: toDelete.size,
    kept: waypoints.length - toDelete.size,
  };
}

/**
 * Draws corridor lines onto the map: each line gets its in-between waypoints, chained end to end
 * with bidirectional edges. Lines sharing an end share the node there, an end on an existing node
 * reuses it, and a new waypoint placed on an existing edge splits that edge there.
 */
export function addWaypointLines(
  map: MapState,
  storeId: string,
  points: WaypointLinePoint[],
  segments: WaypointLineSegment[],
  newId: () => string = () => crypto.randomUUID(),
): MapState {
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const usedKeys = new Set(segments.flatMap((s) => [s.from, s.to]));
  const waypointAt = (id: string, x: number, y: number): MapNode => ({
    id,
    storeId,
    type: "waypoint",
    label: NODE_TYPE_LABELS.waypoint,
    position: { x, y },
  });

  const newNodes: MapNode[] = [];
  const ends = new Map<string, { id: string; x: number; y: number }>();
  const pointsOnEdges = new Map<string, Array<{ id: string; x: number; y: number }>>();
  for (const point of points) {
    if (!usedKeys.has(point.key) || ends.has(point.key)) continue;
    if ("nodeId" in point) {
      const node = nodeById.get(point.nodeId);
      if (node) ends.set(point.key, { id: node.id, ...node.position });
      continue;
    }
    const end = { id: newId(), x: point.x, y: point.y };
    newNodes.push(waypointAt(end.id, end.x, end.y));
    ends.set(point.key, end);
    if (point.edgeId) pointsOnEdges.set(point.edgeId, [...(pointsOnEdges.get(point.edgeId) ?? []), end]);
  }

  const newEdges: MapEdge[] = [];
  const addEdge = (fromNodeId: string, toNodeId: string, bidirectional: boolean) =>
    newEdges.push({ id: newId(), storeId, fromNodeId, toNodeId, bidirectional });

  // Each edge a new waypoint was placed on becomes a chain through those waypoints, in order
  // along it, keeping its direction setting.
  const replacedEdgeIds = new Set<string>();
  for (const [edgeId, onEdge] of pointsOnEdges) {
    const edge = map.edges.find((e) => e.id === edgeId);
    const a = edge && nodeById.get(edge.fromNodeId);
    const b = edge && nodeById.get(edge.toNodeId);
    if (!edge || !a || !b) continue;
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const along = (p: GeoPoint) => (p.x - a.position.x) * dx + (p.y - a.position.y) * dy;
    const chain = [a.id, ...[...onEdge].sort((p, q) => along(p) - along(q)).map((p) => p.id), b.id];
    for (let i = 1; i < chain.length; i++) addEdge(chain[i - 1], chain[i], edge.bidirectional);
    replacedEdgeIds.add(edgeId);
  }

  for (const segment of segments) {
    const from = ends.get(segment.from);
    const to = ends.get(segment.to);
    if (!from || !to || from.id === to.id) continue;
    const chain = [from.id];
    for (let i = 1; i <= segment.count; i++) {
      const t = i / (segment.count + 1);
      const id = newId();
      newNodes.push(waypointAt(id, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t));
      chain.push(id);
    }
    chain.push(to.id);
    for (let i = 1; i < chain.length; i++) addEdge(chain[i - 1], chain[i], true);
  }

  return {
    ...map,
    nodes: [...map.nodes, ...newNodes],
    edges: [...map.edges.filter((e) => !replacedEdgeIds.has(e.id)), ...newEdges],
  };
}

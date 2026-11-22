import { describe, expect, it } from "vitest";
import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode, MapNodeType } from "@smartroute/core/domain/entities/map-node";
import {
  type MapState,
  addWaypointLines,
  applyMapChanges,
  diffMap,
  hasMapChanges,
  pushChange,
  rebaseHistory,
  removeFromMap,
  removeWaypoints,
  undoChange,
} from "@/src/presentation/components/admin/map-draft";
import {
  EMPTY_LINE_DRAFT,
  addPoint,
  connect,
  undoLastLineStep,
} from "@/src/presentation/components/admin/waypoint-line-draft";

const node = (id: string, x: number, y: number, type: MapNodeType = "waypoint"): MapNode => ({
  id,
  storeId: "s",
  type,
  label: id,
  position: { x, y },
});
const edge = (id: string, fromNodeId: string, toNodeId: string, bidirectional = true): MapEdge => ({
  id,
  storeId: "s",
  fromNodeId,
  toNodeId,
  bidirectional,
});

const saved: MapState = {
  nodes: [node("a", 0, 0), node("b", 1, 0), node("d", 0.5, 0.5, "department")],
  edges: [edge("ab", "a", "b"), edge("bd", "b", "d")],
  videoPositions: { v: { x: 0.2, y: 0.2 } },
};
const moved = (map: MapState, id: string, x: number): MapState => ({
  ...map,
  nodes: map.nodes.map((n) => (n.id === id ? { ...n, position: { x, y: n.position.y } } : n)),
});

describe("map draft", () => {
  it("has nothing to save when the draft equals the saved map, even as copies", () => {
    expect(hasMapChanges(diffMap(saved, structuredClone(saved)))).toBe(false);
  });

  it("writes only what differs", () => {
    const draft: MapState = {
      nodes: [...moved(saved, "a", 0.1).nodes.filter((n) => n.id !== "b"), node("c", 0.9, 0.9)],
      edges: [edge("ac", "a", "c")],
      videoPositions: { v: { x: 0.3, y: 0.2 } },
    };
    expect(diffMap(saved, draft)).toEqual({
      createdNodes: [node("c", 0.9, 0.9)],
      updatedNodes: [{ id: "a", position: { x: 0.1, y: 0 } }],
      deletedNodeIds: ["b"],
      createdEdges: [edge("ac", "a", "c")],
      deletedEdgeIds: ["ab", "bd"],
      movedVideos: [{ id: "v", position: { x: 0.3, y: 0.2 } }],
    });
  });

  it("clears an area with an explicit null", () => {
    const withArea: MapState = {
      ...saved,
      nodes: saved.nodes.map((n) =>
        n.id === "d" ? { ...n, area: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] } : n,
      ),
    };
    expect(diffMap(withArea, saved).updatedNodes).toEqual([{ id: "d", area: null }]);
    expect(applyMapChanges(withArea, diffMap(withArea, saved)).nodes.find((n) => n.id === "d")?.area).toBeUndefined();
  });

  it("undoes step by step, and the last undo ends the draft", () => {
    const one = moved(saved, "a", 0.1);
    const two = moved(one, "b", 0.9);
    const history = pushChange(pushChange(null, saved, one), saved, two)!;
    expect(history.present).toBe(two);
    const back = undoChange(history)!;
    expect(back.present).toBe(one);
    expect(undoChange(back)).toBeNull();
  });

  it("doesn't count an edit that changed nothing as a step", () => {
    expect(pushChange(null, saved, saved)).toBeNull();
  });

  it("keeps the draft and its undo steps when the saved map changes underneath", () => {
    const one = moved(saved, "a", 0.1);
    const history = pushChange(null, saved, one)!;
    const newer: MapState = { ...saved, nodes: [...saved.nodes, node("x", 0.7, 0.7)] };
    const rebased = rebaseHistory(history, newer);
    expect(rebased.present.nodes.find((n) => n.id === "a")?.position.x).toBe(0.1);
    expect(rebased.present.nodes.some((n) => n.id === "x")).toBe(true);
    expect(hasMapChanges(diffMap(rebased.base, rebased.past[0]))).toBe(false);
  });

  it("drops a drafted edge whose node was deleted elsewhere", () => {
    const draft: MapState = { ...saved, edges: [...saved.edges, edge("ad", "a", "d")] };
    const history = pushChange(null, saved, draft)!;
    const newer = removeFromMap(saved, new Set(["d"]), new Set());
    expect(rebaseHistory(history, newer).present.edges.map((e) => e.id)).toEqual(["ab"]);
  });

  it("after a save lands, the same draft on the new map has nothing left to write", () => {
    const draft: MapState = {
      ...moved(saved, "a", 0.1),
      nodes: [...moved(saved, "a", 0.1).nodes, node("c", 0.9, 0.9)],
      edges: [...saved.edges, edge("ac", "a", "c")],
    };
    const history = pushChange(null, saved, draft)!;
    const rebased = rebaseHistory(history, structuredClone(draft));
    expect(hasMapChanges(diffMap(rebased.base, rebased.present))).toBe(false);
  });

  it("deleting a node takes its edges along", () => {
    const after = removeFromMap(saved, new Set(["b"]), new Set());
    expect(after.nodes.map((n) => n.id)).toEqual(["a", "d"]);
    expect(after.edges).toEqual([]);
  });

  it("the reset keeps departments and waypoints with products on them", () => {
    const { map, deleted, kept } = removeWaypoints(saved, new Set(["a"]));
    expect(map.nodes.map((n) => n.id)).toEqual(["a", "d"]);
    expect({ deleted, kept }).toEqual({ deleted: 1, kept: 1 });
  });
});

describe("drawing lines on the draft", () => {
  const ids = () => {
    let i = 0;
    return () => `n${++i}`;
  };

  it("chains a line's in-between points, joining an existing node", () => {
    const after = addWaypointLines(
      saved,
      "s",
      [
        { key: "from", nodeId: "a" },
        { key: "to", x: 0, y: 1 },
      ],
      [{ from: "from", to: "to", count: 1 }],
      ids(),
    );
    const added = after.nodes.slice(saved.nodes.length);
    expect(added.map((n) => n.position)).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 0.5 },
    ]);
    expect(after.edges.slice(saved.edges.length).map((e) => [e.fromNodeId, e.toNodeId])).toEqual([
      ["a", "n2"],
      ["n2", "n1"],
    ]);
  });

  it("splits an edge a new end sits on, keeping its direction", () => {
    const oneWay: MapState = { ...saved, edges: [edge("ab", "a", "b", false)] };
    const after = addWaypointLines(
      oneWay,
      "s",
      [
        { key: "on", x: 0.5, y: 0, edgeId: "ab" },
        { key: "to", nodeId: "d" },
      ],
      [{ from: "on", to: "to", count: 0 }],
      ids(),
    );
    expect(after.edges.some((e) => e.id === "ab")).toBe(false);
    expect(after.edges.map((e) => [e.fromNodeId, e.toNodeId, e.bidirectional])).toEqual([
      ["a", "n1", false],
      ["n1", "b", false],
      ["n1", "d", true],
    ]);
  });

  it("Ctrl+Z takes back the line just drawn and keeps stretching from its start", () => {
    let d = addPoint(EMPTY_LINE_DRAFT, { x: 0, y: 0 }, "a").draft;
    d = addPoint(d, { x: 1, y: 0 }, "b").draft;
    d = { ...connect(d, "a", "b", 2), pendingFrom: "b" };
    const back = undoLastLineStep(d);
    expect(back.segments).toEqual([]);
    expect(back.pendingFrom).toBe("a");
    expect(back.points.map((p) => p.key)).toEqual(["a"]);
    expect(undoLastLineStep(back)).toEqual(EMPTY_LINE_DRAFT);
  });
});

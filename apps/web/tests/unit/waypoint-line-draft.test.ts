import { describe, expect, it } from "vitest";
import {
  EMPTY_LINE_DRAFT,
  addPoint,
  cancelPending,
  connect,
  detachFromNode,
  hitDraft,
  hitDraftLine,
  nearestOnSegment,
  innerPoints,
  moveSegment,
  removeLastSegment,
  splitAt,
  splitAtPosition,
  uniformCount,
  withUniformSpacing,
} from "@/src/presentation/components/admin/waypoint-line-draft";

const W = 1000;
const H = 1000;

function twoPointLine(count: number) {
  let d = addPoint(EMPTY_LINE_DRAFT, { x: 0, y: 0.5 }, "a").draft;
  d = addPoint(d, { x: 1, y: 0.5 }, "b").draft;
  return connect(d, "a", "b", count);
}

describe("waypoint line draft", () => {
  it("spaces in-between points evenly", () => {
    expect(innerPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, 3).map((p) => p.x)).toEqual([0.25, 0.5, 0.75]);
  });

  it("gives every line points by its length alone, with no upper cap on a long line", () => {
    expect(uniformCount({ x: 0, y: 0 }, { x: 0.5, y: 0 }, W, H, 0.1)).toBe(4);
    expect(uniformCount({ x: 0, y: 0 }, { x: 0.01, y: 0 }, W, H, 0.1)).toBe(0);
    expect(uniformCount({ x: 0, y: 0 }, { x: 0, y: 1 }, 100, 1000, 0.04)).toBe(249);
  });

  it("re-derives point counts after a line is moved or split", () => {
    const d = twoPointLine(17);
    expect(withUniformSpacing(d, W, H, 0.1).segments[0].count).toBe(9);
    const split = splitAtPosition(d, 0, 0.3, "m").draft;
    expect(withUniformSpacing(split, W, H, 0.1).segments.map((s) => s.count)).toEqual([2, 6]);
  });

  it("hits a line's ends before its in-between points", () => {
    const d = twoPointLine(3);
    expect(hitDraft(d, { x: 0.001, y: 0.5 }, 10, W, H)).toEqual({ kind: "end", key: "a" });
    expect(hitDraft(d, { x: 0.5, y: 0.502 }, 10, W, H)).toEqual({ kind: "inner", segment: 0, index: 2 });
    expect(hitDraft(d, { x: 0.4, y: 0.5 }, 10, W, H)).toBeNull();
  });

  it("splitting at an in-between point keeps every point where it was", () => {
    const d = twoPointLine(3);
    const { draft, key } = splitAt(d, 0, 2, "m");
    expect(draft.segments).toEqual([
      { from: "a", to: "m", count: 1 },
      { from: "m", to: "b", count: 1 },
    ]);
    expect(draft.points.find((p) => p.key === key)).toEqual({ key: "m", x: 0.5, y: 0.5 });
    const xs = [
      ...innerPoints({ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, 1),
      { x: 0.5, y: 0.5 },
      ...innerPoints({ x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, 1),
    ].map((p) => p.x);
    expect(xs).toEqual(innerPoints({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 3).map((p) => p.x));
  });

  it("reuses the end already on a node", () => {
    const d = addPoint(EMPTY_LINE_DRAFT, { nodeId: "n1", x: 0.2, y: 0.2 }, "a").draft;
    const again = addPoint(d, { nodeId: "n1", x: 0.2, y: 0.2 }, "b");
    expect(again.key).toBe("a");
    expect(again.draft.points).toHaveLength(1);
  });

  it("detaching an end from its node keeps it in place as a plain point", () => {
    let d = addPoint(EMPTY_LINE_DRAFT, { nodeId: "dept", x: 0.2, y: 0.2 }, "a").draft;
    d = connect(addPoint(d, { x: 0.8, y: 0.2 }, "b").draft, "a", "b", 2);
    const detached = detachFromNode(d, "dept");
    expect(detached.points[0]).toEqual({ key: "a", x: 0.2, y: 0.2 });
    expect(detached.segments).toEqual(d.segments);
  });

  it("ignores a line from an end to itself", () => {
    const d = addPoint(EMPTY_LINE_DRAFT, { x: 0.2, y: 0.2 }, "a").draft;
    expect(connect(d, "a", "a", 2).segments).toHaveLength(0);
  });

  it("cancelling or undoing drops ends no line uses", () => {
    const d = twoPointLine(2);
    const pending = { ...addPoint(d, { x: 0.3, y: 0.9 }, "c").draft, pendingFrom: "c" };
    expect(cancelPending(pending).points.map((p) => p.key)).toEqual(["a", "b"]);
    expect(removeLastSegment(d)).toEqual(EMPTY_LINE_DRAFT);
  });

  it("moves a line parallel to itself, the line before it stretching along", () => {
    let d = addPoint(EMPTY_LINE_DRAFT, { nodeId: "dept", x: 0.1, y: 0.1 }, "a").draft;
    d = addPoint(d, { x: 0.1, y: 0.5 }, "b").draft;
    d = addPoint(d, { x: 0.9, y: 0.5 }, "c").draft;
    d = connect(connect(d, "a", "b", 1), "b", "c", 3);
    const moved = moveSegment(d, 1, 0, 0.01);
    expect(moved.points).toEqual([
      { key: "a", nodeId: "dept", x: 0.1, y: 0.1 },
      { key: "b", x: 0.1, y: 0.51 },
      { key: "c", x: 0.9, y: 0.51 },
    ]);
    expect(moved.segments).toEqual(d.segments);
  });

  it("finds the nearest spot on a segment", () => {
    const near = nearestOnSegment({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0.3, y: 0.51 }, W, H);
    expect(near.t).toBeCloseTo(0.3);
    expect(near.point).toEqual({ x: 0.3, y: 0.5 });
    expect(near.distance).toBeCloseTo(10);
  });

  it("hits a drafted line anywhere between its ends", () => {
    const d = twoPointLine(3);
    expect(hitDraftLine(d, { x: 0.37, y: 0.505 }, 10, W, H)).toEqual({ segment: 0, t: 0.37 });
    expect(hitDraftLine(d, { x: 0.37, y: 0.6 }, 10, W, H)).toBeNull();
  });

  it("splits a drafted line at any spot, sharing out its in-between points", () => {
    const d = twoPointLine(3); // in-between points at 0.25, 0.5, 0.75
    const { draft, key } = splitAtPosition(d, 0, 0.6, "m");
    expect(draft.points.find((p) => p.key === key)).toEqual({ key: "m", x: 0.6, y: 0.5 });
    expect(draft.segments).toEqual([
      { from: "a", to: "m", count: 2 },
      { from: "m", to: "b", count: 1 },
    ]);
  });
});

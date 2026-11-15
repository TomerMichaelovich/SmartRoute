import { describe, expect, it } from "vitest";
import {
  EMPTY_LINE_DRAFT,
  addPoint,
  cancelPending,
  connect,
  hitDraft,
  innerPoints,
  removeLastSegment,
  splitAt,
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
});

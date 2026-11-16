import { describe, expect, it } from "vitest";
import {
  alignPositions,
  autoStraighten,
  snapToGuides,
  straightOntoSegment,
} from "@/src/presentation/components/admin/map-editor-snapping";

const W = 1000;
const H = 500;

describe("map editor snapping", () => {
  it("lines a point up with another point's x and y, each within the threshold", () => {
    const { point, guides } = snapToGuides({ x: 0.503, y: 0.7 }, [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.704 }], 5, W, H);
    expect(point).toEqual({ x: 0.5, y: 0.704 });
    expect(guides).toEqual({ x: 0.5, y: 0.704 });
  });

  it("leaves an axis alone when nothing is close on it", () => {
    const { point, guides } = snapToGuides({ x: 0.3, y: 0.3 }, [{ x: 0.5, y: 0.5 }], 5, W, H);
    expect(point).toEqual({ x: 0.3, y: 0.3 });
    expect(guides).toEqual({ x: undefined, y: undefined });
  });

  it("straightens a nearly horizontal or vertical line, and only those", () => {
    const start = { x: 0.1, y: 0.5 };
    expect(autoStraighten(start, { x: 0.5, y: 0.52 }, W, H, 7)).toEqual({ x: 0.5, y: 0.5 }); // ~1.4°
    expect(autoStraighten(start, { x: 0.105, y: 0.9 }, W, H, 7)).toEqual({ x: 0.1, y: 0.9 }); // ~89°
    expect(autoStraighten(start, { x: 0.3, y: 0.7 }, W, H, 7)).toEqual({ x: 0.3, y: 0.7 }); // diagonal
  });

  it("aligns to a row or a column at the average", () => {
    const items = [
      { id: "a", x: 0.1, y: 0.2 },
      { id: "b", x: 0.3, y: 0.4 },
    ];
    expect(alignPositions(items, "row", W, H)).toEqual([
      { id: "a", x: 0.1, y: 0.30000000000000004 },
      { id: "b", x: 0.3, y: 0.30000000000000004 },
    ]);
    expect(alignPositions(items, "column", W, H).map((p) => p.x)).toEqual([0.2, 0.2]);
  });

  it("distributes evenly between the outermost along the wider spread", () => {
    const items = [
      { id: "c", x: 0.9, y: 0.5 },
      { id: "a", x: 0.1, y: 0.5 },
      { id: "b", x: 0.2, y: 0.51 },
    ];
    const out = alignPositions(items, "distribute", W, H);
    expect(out.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(out.map((p) => p.x)).toEqual([0.1, 0.5, 0.9]);
    expect(out[1].y).toBe(0.51);
  });

  it("slides an end along the target line so a nearly straight line comes out straight", () => {
    const start = { x: 0.1, y: 0.5 };
    // Target: a vertical corridor at x = 0.6; the click landed on it a little below start's height.
    const end = straightOntoSegment(start, { x: 0.6, y: 0.52 }, { x: 0.6, y: 0.1 }, { x: 0.6, y: 0.9 }, W, H, 7);
    expect(end.x).toBeCloseTo(0.6);
    expect(end.y).toBeCloseTo(0.5);
    // Far off straight: left where it was clicked.
    expect(straightOntoSegment(start, { x: 0.6, y: 0.85 }, { x: 0.6, y: 0.1 }, { x: 0.6, y: 0.9 }, W, H, 7)).toEqual({
      x: 0.6,
      y: 0.85,
    });
  });
});

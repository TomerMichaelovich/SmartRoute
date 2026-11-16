import { describe, expect, it } from "vitest";
import { pointInPolygon, stopMarkerPlacement } from "@smartroute/core/map/stop-marker";

const W = 1000;
const H = 1000;
// A shelf area left of a vertical aisle at x = 0.5; the department node sits on the shelf.
const area = [
  { x: 0.3, y: 0.3 },
  { x: 0.45, y: 0.3 },
  { x: 0.45, y: 0.6 },
  { x: 0.3, y: 0.6 },
];
const positions: Record<string, { x: number; y: number }> = {
  entrance: { x: 0.5, y: 0.95 },
  aisle: { x: 0.5, y: 0.45 },
  insideArea: { x: 0.44, y: 0.45 },
  dept: { x: 0.38, y: 0.45 },
};
const positionOf = (id: string) => positions[id];

describe("stop marker placement", () => {
  it("tells inside from outside", () => {
    expect(pointInPolygon({ x: 0.4, y: 0.4 }, area)).toBe(true);
    expect(pointInPolygon({ x: 0.5, y: 0.4 }, area)).toBe(false);
  });

  it("moves the marker onto the path where it reaches the area, name facing away from it", () => {
    const placed = stopMarkerPlacement("dept", positions.dept, area, ["entrance", "aisle", "dept"], positionOf, W, H);
    expect(placed).toEqual({ position: positions.aisle, labelSide: "right" });
  });

  it("skips path points inside the area", () => {
    const path = ["entrance", "aisle", "insideArea", "dept"];
    expect(stopMarkerPlacement("dept", positions.dept, area, path, positionOf, W, H).position).toEqual(positions.aisle);
  });

  it("stays on the department without an area, or when the path doesn't lead to it", () => {
    const fallback = { position: positions.dept, labelSide: "above" };
    expect(stopMarkerPlacement("dept", positions.dept, undefined, ["entrance", "aisle", "dept"], positionOf, W, H)).toEqual(
      fallback,
    );
    expect(stopMarkerPlacement("dept", positions.dept, area, ["entrance", "aisle"], positionOf, W, H)).toEqual(fallback);
  });
});

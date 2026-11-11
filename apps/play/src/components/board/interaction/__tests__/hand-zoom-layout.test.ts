import { describe, expect, it } from "vitest";

import { computeHandZoomLayout } from "../HandZoomLayer";

const vp = { width: 1600, height: 900 };

describe("computeHandZoomLayout", () => {
  it("is ~45% of viewport height and sits above the bottom edge", () => {
    const l = computeHandZoomLayout({ left: 700, top: 780, width: 94, height: 126 }, vp);
    expect(l.height).toBeGreaterThanOrEqual(360);
    expect(l.height / vp.height).toBeLessThan(0.5);
    expect(l.top + l.height).toBeLessThanOrEqual(vp.height);
  });
  it("clamps inside the viewport at the left and right edges", () => {
    const left = computeHandZoomLayout({ left: 0, top: 780, width: 94, height: 126 }, vp);
    const right = computeHandZoomLayout({ left: 1506, top: 780, width: 94, height: 126 }, vp);
    expect(left.left).toBeGreaterThanOrEqual(0);
    expect(right.left + right.width).toBeLessThanOrEqual(vp.width);
    expect(left.rulesSide).toBe("right");
    expect(right.rulesSide).toBe("left");
    expect(right.rulesLeft).toBeGreaterThanOrEqual(0);
  });
});

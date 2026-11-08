import { describe, expect, it } from "vitest";

import { computeHoverPreviewLayout, hoverPreviewSize, HOVER_PREVIEW_MARGIN_PX } from "../hover-metrics";

const anchor = { left: 400, top: 200, right: 480, bottom: 312, width: 80, height: 112 };

describe("hover preview layout", () => {
  it("uses the original-size portrait bucket and card aspect", () => {
    const size = hoverPreviewSize({ viewportWidth: 1440, viewportHeight: 900 });
    expect(size.outerWidth).toBeGreaterThanOrEqual(192);
    expect(size.imageHeight).toBeCloseTo(size.imageWidth * 1.392857, 0);
  });

  it("prefers the right side when it fits", () => {
    const layout = computeHoverPreviewLayout({ anchor, viewportWidth: 1440, viewportHeight: 900 });
    expect(layout.placement).toBe("right");
    expect(layout.x).toBe(anchor.right + 12);
  });

  it("flips left when the right side is too tight", () => {
    const layout = computeHoverPreviewLayout({
      anchor: { ...anchor, left: 1200, right: 1280 },
      viewportWidth: 1320,
      viewportHeight: 900,
    });
    expect(layout.placement).toBe("left");
    expect(layout.x).toBeGreaterThanOrEqual(HOVER_PREVIEW_MARGIN_PX);
  });

  it("clamps into the viewport including the rules panel", () => {
    const layout = computeHoverPreviewLayout({
      anchor: { ...anchor, top: 800, bottom: 900 },
      viewportWidth: 1280,
      viewportHeight: 900,
      rulesHeight: 140,
    });
    expect(layout.y).toBeGreaterThanOrEqual(HOVER_PREVIEW_MARGIN_PX);
    expect(layout.y + layout.outerHeight + 4 + 140).toBeLessThanOrEqual(900);
  });

  it("uses the landscape aspect for battlefield markers", () => {
    const layout = computeHoverPreviewLayout({ anchor, viewportWidth: 1440, viewportHeight: 900, landscape: true });
    expect(layout.outerWidth).toBeGreaterThan(layout.outerHeight);
  });
});

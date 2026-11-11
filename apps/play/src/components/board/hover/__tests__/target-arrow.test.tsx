import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildArrowGeometry, quadTangent } from "../arrow-geometry";
import { ARROW_PALETTE, ArrowGlyph, paletteFromSolid } from "../TargetArrowOverlay";

const curve = { startX: 100, startY: 500, endX: 700, endY: 200, ctrlX: 340, ctrlY: 280 };

describe("tapered arrow geometry", () => {
  const g = buildArrowGeometry(
    { x: curve.startX, y: curve.startY },
    { x: curve.ctrlX, y: curve.ctrlY },
    { x: curve.endX, y: curve.endY },
  );

  it("is thin at the source and ~10-14px at the head end", () => {
    expect(g.widthStart).toBeLessThan(4);
    expect(g.widthEnd).toBeGreaterThanOrEqual(10);
    expect(g.widthEnd).toBeLessThanOrEqual(14);
    expect(g.body.startsWith("M ")).toBe(true);
    expect(g.body.endsWith("Z")).toBe(true);
  });

  it("puts the spearhead tip on the target, oriented on the curve tangent", () => {
    expect(g.tip).toEqual({ x: 700, y: 200 });
    expect(g.head.startsWith("M 700.00 200.00")).toBe(true);
    const t = quadTangent({ x: 100, y: 500 }, { x: 340, y: 280 }, { x: 700, y: 200 }, 1);
    expect(g.dir.x).toBeCloseTo(t.x, 5);
    expect(g.dir.y).toBeCloseTo(t.y, 5);
    expect(g.angleDeg).toBeCloseTo((Math.atan2(t.y, t.x) * 180) / Math.PI, 5);
    expect(g.headHalfWidth).toBeGreaterThan(g.widthEnd / 2);
  });

  it("shrinks the glyph for very short arrows and never yields NaN", () => {
    const tiny = buildArrowGeometry({ x: 10, y: 10 }, { x: 10, y: 9 }, { x: 10, y: 10 });
    expect(tiny.body).not.toContain("NaN");
    expect(tiny.head).not.toContain("NaN");
    const short = buildArrowGeometry({ x: 0, y: 0 }, { x: 20, y: -10 }, { x: 40, y: 0 });
    expect(short.headLength).toBeLessThan(g.headLength);
  });
});

describe("ArrowGlyph", () => {
  it("renders outline, gradient, flowing energy and a lock-on ring for a valid snap", () => {
    const html = renderToStaticMarkup(<ArrowGlyph uid="t" curve={curve} palette={ARROW_PALETTE.valid} lock="valid" />);
    expect(html).toContain('data-arrow-body="true"');
    expect(html).toContain('data-arrow-head="true"');
    expect(html).toContain("rb-arrow-flow");
    expect(html).toContain('data-arrow-lockon="true"');
    expect(html).toContain("url(#t-grad)");
    expect(html).not.toContain("data-arrow-invalid-x");
  });

  it("shows the shaking X (and no lock ring) for an invalid target; passive arrows have neither", () => {
    const invalid = renderToStaticMarkup(<ArrowGlyph uid="t" curve={curve} palette={ARROW_PALETTE.invalid} lock="invalid" />);
    expect(invalid).toContain('data-arrow-invalid-x="true"');
    expect(invalid).toContain("rb-arrow-shake");
    expect(invalid).not.toContain("data-arrow-lockon");
    const passive = renderToStaticMarkup(<ArrowGlyph uid="t" curve={curve} palette={paletteFromSolid("#69c8e6")} lock="none" />);
    expect(passive).not.toContain("data-arrow-lockon");
    expect(passive).not.toContain("data-arrow-invalid-x");
    expect(passive).toContain("#69c8e6");
  });
});

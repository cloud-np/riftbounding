/**
 * Targeting-arrow geometry: a tapered filled body that follows a quadratic Bezier, plus a
 * spearhead oriented on the curve tangent. Pure functions (unit-tested) so the overlay only
 * decides colours/animation.
 */
export interface Point {
  x: number;
  y: number;
}

export interface ArrowGeometry {
  /** Closed outline of the tapered shaft (thin at the source, thick at the head). */
  body: string;
  /** Closed spearhead polygon whose tip sits exactly on the target point. */
  head: string;
  /** Open centre line of the shaft (source -> head base), for flowing energy strokes. */
  center: string;
  tip: Point;
  /** Unit tangent at the tip (points source -> target). */
  dir: Point;
  /** Tip heading in degrees (SVG rotation). */
  angleDeg: number;
  headLength: number;
  headHalfWidth: number;
  /** Shaft thickness at the source and where it meets the head. */
  widthStart: number;
  widthEnd: number;
  length: number;
}

const f = (n: number) => n.toFixed(2);

export function quadPoint(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

export function quadTangent(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  const x = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x);
  const y = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function buildArrowGeometry(a: Point, c: Point, b: Point): ArrowGeometry {
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  // Short arrows shrink the whole glyph so the head never swallows the shaft.
  const scale = clamp(chord / 170, 0.5, 1);
  const headLength = 30 * scale;
  const headHalfWidth = 17 * scale;
  const widthStart = 3.2 * scale;
  const widthEnd = 12.5 * scale;

  // Arc-length table to find where the shaft ends (one head length before the tip).
  const STEPS = 64;
  const pts: Point[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= STEPS; i += 1) {
    const p = quadPoint(a, c, b, i / STEPS);
    pts.push(p);
    if (i > 0) cum.push(cum[i - 1]! + Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y));
  }
  const length = cum[STEPS]!;
  const bodyLen = Math.max(length - headLength * 0.8, length * 0.2);
  let tBody = 1;
  for (let i = 1; i <= STEPS; i += 1) {
    if (cum[i]! >= bodyLen) {
      const span = cum[i]! - cum[i - 1]! || 1;
      tBody = (i - 1 + (bodyLen - cum[i - 1]!) / span) / STEPS;
      break;
    }
  }

  const N = 22;
  const left: Point[] = [];
  const right: Point[] = [];
  const center: Point[] = [];
  for (let i = 0; i <= N; i += 1) {
    const u = i / N;
    const t = u * tBody;
    const p = quadPoint(a, c, b, t);
    const d = quadTangent(a, c, b, t);
    const w = (widthStart + (widthEnd - widthStart) * u ** 1.35) / 2;
    left.push({ x: p.x - d.y * w, y: p.y + d.x * w });
    right.push({ x: p.x + d.y * w, y: p.y - d.x * w });
    center.push(p);
  }
  const body =
    `M ${f(left[0]!.x)} ${f(left[0]!.y)} ` +
    left.slice(1).map((p) => `L ${f(p.x)} ${f(p.y)}`).join(" ") +
    " " +
    right.reverse().map((p) => `L ${f(p.x)} ${f(p.y)}`).join(" ") +
    " Z";

  const dir = quadTangent(a, c, b, 1);
  const base = { x: b.x - dir.x * headLength, y: b.y - dir.y * headLength };
  const nx = -dir.y;
  const ny = dir.x;
  const notch = { x: base.x + dir.x * headLength * 0.3, y: base.y + dir.y * headLength * 0.3 };
  const head =
    `M ${f(b.x)} ${f(b.y)} ` +
    `L ${f(base.x + nx * headHalfWidth)} ${f(base.y + ny * headHalfWidth)} ` +
    `L ${f(notch.x)} ${f(notch.y)} ` +
    `L ${f(base.x - nx * headHalfWidth)} ${f(base.y - ny * headHalfWidth)} Z`;

  return {
    body,
    head,
    center: center.map((p, i) => `${i === 0 ? "M" : "L"} ${f(p.x)} ${f(p.y)}`).join(" "),
    tip: { x: b.x, y: b.y },
    dir,
    angleDeg: (Math.atan2(dir.y, dir.x) * 180) / Math.PI,
    headLength,
    headHalfWidth,
    widthStart,
    widthEnd,
    length,
  };
}

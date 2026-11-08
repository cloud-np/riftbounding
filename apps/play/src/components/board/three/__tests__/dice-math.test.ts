import { describe, expect, it } from "vitest";
import { DodecahedronGeometry, Quaternion, Vector3 } from "three";

import {
  BOUNCE_SLOPE,
  DiceMotion,
  bounceHeight,
  buildInsetPlateGeometry,
  clamp01,
  initiativeColor,
  isUnderlinedDieValue,
  seededRandom,
  seedFromTimestamp,
} from "../dice-math";

describe("initiative dice maths", () => {
  it("uses the exact bounce curve constants", () => {
    expect(BOUNCE_SLOPE).toBeCloseTo(3.05, 10);
    expect(bounceHeight(0)).toBeCloseTo(1.05, 10);
    expect(bounceHeight(0.6)).toBeCloseTo(1.05 + BOUNCE_SLOPE * 0.6 - 8 * 0.36, 10);
    expect(bounceHeight(1.7)).toBeGreaterThanOrEqual(0);
    expect(bounceHeight(5)).toBe(0);
  });

  it("clamps the tumble parameter", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });

  it("underlines only 6 and 9", () => {
    expect([5, 6, 9, 10].filter(isUnderlinedDieValue)).toEqual([6, 9]);
  });

  it("uses the per-seat dice colours", () => {
    expect(initiativeColor(true, "opponent")).toBe(0x2bc78f);
    expect(initiativeColor(false, "ally")).toBe(0x4fafd0);
    expect(initiativeColor(false, "opponent")).toBe(0xd88936);
  });

  it("is deterministic for a start timestamp", () => {
    const seed = seedFromTimestamp(1_766_000_000_000);
    const a = new DiceMotion(seededRandom(seed));
    const b = new DiceMotion(seededRandom(seed));
    expect(a.direction).toBe(b.direction);
    expect(a.turns).toBe(b.turns);
    expect(a.axis.distanceTo(b.axis)).toBe(0);
  });

  it("settles at the end of the 1.7s tumble", () => {
    const motion = new DiceMotion(seededRandom(7));
    const settled = motion.sample(1.7, new Quaternion(), [new Vector3(0, 0.62, 0)]);
    const alsoSettled = motion.sample(3.4, new Quaternion(), [new Vector3(0, 0.62, 0)]);
    expect(settled.quaternion.angleTo(alsoSettled.quaternion)).toBeLessThan(1e-6);
    expect(settled.position.y).toBeCloseTo(alsoSettled.position.y, 6);
  });

  it("builds 36 inset plates with two material groups", () => {
    const source = new DodecahedronGeometry(0.62, 0);
    const data = buildInsetPlateGeometry(source);
    expect(data.insetTriangleCount).toBe(36);
    expect(data.positions.length / 3).toBeGreaterThan(36);
    expect(data.positions.length % 9).toBe(0);
    expect(data.vertexPositions.length).toBeGreaterThan(0);
    source.dispose();
  });
});

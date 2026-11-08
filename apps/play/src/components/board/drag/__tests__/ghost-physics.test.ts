import { describe, expect, it } from "vitest";

import {
  createGhostMotionState,
  GHOST_VELOCITY_SMOOTHING_NEW,
  resetGhostMotion,
  sampleGhostPointer,
  stepGhostFrame,
} from "../ghost-physics";

describe("ghost physics", () => {
  it("smooths velocity with the original 0.45 / 0.55 EMA", () => {
    const state = createGhostMotionState();
    state.active = true;
    sampleGhostPointer(state, { x: 0, y: 0, timestamp: 100 });
    sampleGhostPointer(state, { x: 20, y: -16, timestamp: 116 });
    expect(state.velocityX).toBeCloseTo(GHOST_VELOCITY_SMOOTHING_NEW * (20 / 16), 8);
    expect(state.velocityY).toBeCloseTo(GHOST_VELOCITY_SMOOTHING_NEW * (-16 / 16), 8);
    expect(state.targetX).toBe(20);
    expect(state.targetY).toBe(-16);
  });

  it("falls back to last + 16ms for missing timestamps", () => {
    const state = createGhostMotionState();
    sampleGhostPointer(state, { x: 100, y: 100, timestamp: 200 });
    sampleGhostPointer(state, { x: 132, y: 132, timestamp: 0 });
    expect(state.lastPointerTs).toBe(216);
    expect(state.velocityX).toBeCloseTo(0.55 * 2, 8);
  });

  it("decays velocity and follows the pointer with exp(-dt/tau)", () => {
    const state = createGhostMotionState();
    state.active = true;
    state.lastFrameTs = 1000;
    state.velocityX = 1;
    state.velocityY = 0;
    const frame = stepGhostFrame(state, 1016);
    expect(state.velocityX).toBeCloseTo(Math.exp(-16 / 118), 8);
    expect(frame.transform).toContain("perspective(980px)");
    expect(frame.transform).toContain("scale(1.02)");
    expect(frame.transform).toContain("rotateX(");
    expect(frame.transform).toContain("rotateZ(");
    expect(frame.rollDeg).toMatch(/deg$/);
  });

  it("clamps tilt to ±13° and roll to ±8°", () => {
    const state = createGhostMotionState();
    state.active = true;
    state.lastFrameTs = 1000;
    state.velocityX = 100;
    state.velocityY = -100;
    stepGhostFrame(state, 1001);
    expect(state.tiltX).toBeLessThanOrEqual(13);
    expect(state.tiltX).toBeGreaterThanOrEqual(-13);
    expect(state.tiltY).toBeLessThanOrEqual(13);
    expect(state.roll).toBeLessThanOrEqual(8);
    expect(state.roll).toBeGreaterThanOrEqual(-8);
  });

  it("collapses to a plain translate with prefers-reduced-motion", () => {
    const state = createGhostMotionState();
    state.active = true;
    state.reduceMotion = true;
    state.targetX = 42.123;
    state.targetY = 12.345;
    const frame = stepGhostFrame(state, 1000);
    expect(frame.transform).toBe("translate3d(42.12px,12.35px,0) translate(-50%, -50%)");
    expect(frame.rollDeg).toBe("0deg");
  });

  it("parks at -9999 after a reset", () => {
    const state = createGhostMotionState();
    state.targetX = 10;
    resetGhostMotion(state);
    expect(state.targetX).toBe(-9999);
    expect(state.active).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParticleEngine, safeRadius } from "../particles";
import { classifyRenderer } from "../quality";

/** Canvas 2D stub that throws exactly like the browser on negative radii. */
function makeCtx() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === "arc") {
        return (_x: number, _y: number, r: number) => {
          if (r < 0) throw new Error(`arc negative radius ${r}`);
          calls.push("arc");
        };
      }
      if (prop === "ellipse") {
        return (_x: number, _y: number, rx: number, ry: number) => {
          if (rx < 0 || ry < 0) throw new Error(`ellipse negative radius ${rx},${ry}`);
          calls.push("ellipse");
        };
      }
      if (prop === "createRadialGradient") {
        return (_a: number, _b: number, r0: number, _c: number, _d: number, r1: number) => {
          if (r0 < 0 || r1 < 0) throw new Error("gradient negative radius");
          return { addColorStop() {} };
        };
      }
      if (prop === "createLinearGradient") return () => ({ addColorStop() {} });
      if (prop in target) return target[prop];
      return () => {};
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function attach(engine: ParticleEngine) {
  const { ctx, calls } = makeCtx();
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
  engine.attach(canvas);
  return { ctx, calls };
}

describe("ParticleEngine with degenerate inputs", () => {
  let rafQueue: Array<(t: number) => void> = [];
  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, location: { search: "" } });
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => rafQueue.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.stubGlobal("performance", { now: () => 1000 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never passes a negative radius to arc/ellipse, even with negative/NaN sizes and time running backwards", () => {
    const engine = new ParticleEngine();
    attach(engine);
    engine.emitCircle(100, 100, "255,0,0", { radius: -523.964, duration: 1 });
    engine.emitCircle(100, 100, "255,0,0", { radius: Number.NaN, duration: 1 });
    engine.emitRing(50, 50, "255,255,255", { radius: -200, from: -40, squash: -1, duration: 0.5 });
    engine.emitRing(50, 50, "255,255,255", { radius: 100, from: 400, squash: 0.4, duration: 0.5 });
    engine.emitFlash(10, 10, "1,2,3", { radius: -50 });
    engine.emitPillar(10, 10, "1,2,3", { height: -300, width: -10 });
    engine.emitStreak(10, 10, "1,2,3", 0, 0, -20);
    // rAF timestamp earlier than performance.now() at kick time (dt would be negative)
    const times = [900, 800, 1100, 1500, 1900, 2400, 3000];
    for (const t of times) {
      const cb = rafQueue.shift();
      if (!cb) break;
      expect(() => cb(t)).not.toThrow();
    }
  });

  it("stops requesting frames once every particle has died (idle = no rAF)", () => {
    const engine = new ParticleEngine();
    attach(engine);
    engine.emitBurst(0, 0, "255,0,0", { count: 6, life: 0.1 });
    let guard = 0;
    let now = 1000;
    while (rafQueue.length && guard < 200) {
      now += 50;
      rafQueue.shift()!(now);
      guard += 1;
    }
    expect(rafQueue.length).toBe(0);
    expect(guard).toBeLessThan(200);
  });

  it("caps live particles by quality tier", () => {
    const engine = new ParticleEngine();
    attach(engine);
    engine.applyTier("software");
    for (let i = 0; i < 40; i += 1) engine.emitBurst(0, 0, "255,0,0", { count: 60 });
    const alive = (engine as unknown as { aliveCount: number }).aliveCount;
    expect(alive).toBeLessThanOrEqual(engine.maxAlive);
    expect(engine.maxAlive).toBeLessThan(1400);
  });

  it("safeRadius clamps negative / non-finite values", () => {
    expect(safeRadius(-5)).toBe(0);
    expect(safeRadius(Number.NaN)).toBe(0);
    expect(safeRadius(Infinity)).toBe(0);
    expect(safeRadius(12)).toBe(12);
  });
});

describe("classifyRenderer", () => {
  it("detects software rasterisers", () => {
    expect(classifyRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)")).toBe("software");
    expect(classifyRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe("software");
    expect(classifyRenderer("Mesa Software Rasterizer")).toBe("software");
  });
  it("treats integrated GPUs as medium and others as high", () => {
    expect(classifyRenderer("ANGLE (Intel, Intel(R) UHD Graphics 620)")).toBe("medium");
    expect(classifyRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)")).toBe("high");
    expect(classifyRenderer(null)).toBe("medium");
  });
});

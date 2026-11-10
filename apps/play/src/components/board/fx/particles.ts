/**
 * Pooled 2D particle engine drawing into ONE fullscreen canvas.
 *
 * - additive ("lighter") blending for glow-type particles, normal blending for dust
 * - glow sprites are pre-rendered to offscreen canvases (one per colour)
 * - rAF runs only while particles are alive; DPR is capped at 2
 * - strictly an imperative API (the choreography layer owns timing)
 */

import { renderTier, type RenderTier } from "./quality";

export type Rgb = string; // "255,84,60"

const Kind = {
  Spark: 0,
  Ember: 1,
  Dust: 2,
  Glow: 3,
  Ring: 4,
  Pillar: 5,
  Circle: 6,
  Streak: 7,
} as const;
type Kind = (typeof Kind)[keyof typeof Kind];

interface Particle {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  age: number;
  life: number;
  size: number;
  size1: number;
  rgb: Rgb;
  alpha: number;
  rot: number;
  rotV: number;
  aux: number;
  aux2: number;
}

const POOL_SIZE = 1400;
const TAU = Math.PI * 2;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function easeOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - (1 - c) * (1 - c) * (1 - c);
}

/** Radius/size guard: canvas arc/ellipse throw on negative or non-finite values. */
export function safeRadius(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

const spriteCache = new Map<string, HTMLCanvasElement>();

function glowSprite(rgb: Rgb): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const hit = spriteCache.get(rgb);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, `rgba(${rgb},0.95)`);
  gradient.addColorStop(0.5, `rgba(${rgb},0.32)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  spriteCache.set(rgb, canvas);
  return canvas;
}

const pillarCache = new Map<string, HTMLCanvasElement>();
/** 64x256 beam: vertical ramp (transparent top, white-hot bottom) feathered towards both sides. */
function pillarSprite(rgb: Rgb): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const hit = pillarCache.get(rgb);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, `rgba(${rgb},0)`);
  gradient.addColorStop(0.7, `rgba(${rgb},0.5)`);
  gradient.addColorStop(1, "rgba(255,255,255,0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  const side = ctx.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, "rgba(0,0,0,0)");
  side.addColorStop(0.5, "rgba(0,0,0,1)");
  side.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 64, 256);
  pillarCache.set(rgb, canvas);
  return canvas;
}

const streakCache = new Map<string, HTMLCanvasElement>();
/** 128x8 horizontal comet tail: white-hot head at x=0 fading to transparent at x=128. */
function streakSprite(rgb: Rgb): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const hit = streakCache.get(rgb);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, `rgba(${rgb},0.8)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.quadraticCurveTo(4, 0, 12, 0);
  ctx.lineTo(128, 3);
  ctx.lineTo(128, 5);
  ctx.lineTo(12, 8);
  ctx.quadraticCurveTo(4, 8, 0, 4);
  ctx.fill();
  streakCache.set(rgb, canvas);
  return canvas;
}

let dustSprite: HTMLCanvasElement | null = null;
function softDust(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (dustSprite) return dustSprite;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, "rgba(210,200,185,0.55)");
  gradient.addColorStop(1, "rgba(210,200,185,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 48, 48);
  dustSprite = canvas;
  return canvas;
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  /** Direction in radians; omit for a full radial burst. */
  angle?: number;
  spread?: number;
  size?: number;
  life?: number;
  gravity?: number;
}

export class ParticleEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private pool: Particle[] = [];
  private cursor = 0;
  private raf = 0;
  private tier: RenderTier = "high";
  private last = 0;
  private dpr = 1;
  private width = 0;
  private height = 0;
  /** Particle budget multiplier (0 disables particles entirely). */
  density = 1;
  /** Hard cap on simultaneously alive particles (quality tier). */
  maxAlive = POOL_SIZE;
  private aliveCount = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i += 1) {
      this.pool.push({
        alive: false,
        kind: Kind.Spark,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0,
        age: 0,
        life: 1,
        size: 1,
        size1: 1,
        rgb: "255,255,255",
        alpha: 1,
        rot: 0,
        rotV: 0,
        aux: 0,
        aux2: 0,
      });
    }
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    this.applyTier(renderTier());
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas = null;
    this.ctx = null;
    this.clear();
  }

  /** Scale the particle budget and canvas resolution to the device tier. */
  applyTier(tier: RenderTier): void {
    this.tier = tier;
    this.density = tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.35;
    this.maxAlive = tier === "high" ? POOL_SIZE : tier === "medium" ? 700 : 320;
    this.resize();
  }

  resize(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.dpr = Math.min(this.tier === "high" ? 2 : 1, window.devicePixelRatio || 1);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = Math.round(this.width * this.dpr);
    canvas.height = Math.round(this.height * this.dpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
  }

  clear(): void {
    for (const particle of this.pool) particle.alive = false;
    this.aliveCount = 0;
    if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private spawn(kind: Kind, rgb: Rgb): Particle | null {
    if (!this.canvas || this.density <= 0 || this.aliveCount >= this.maxAlive) return null;
    for (let i = 0; i < POOL_SIZE; i += 1) {
      const index = (this.cursor + i) % POOL_SIZE;
      const particle = this.pool[index]!;
      if (!particle.alive) {
        this.cursor = (index + 1) % POOL_SIZE;
        particle.alive = true;
        this.aliveCount += 1;
        particle.kind = kind;
        particle.rgb = rgb;
        particle.age = 0;
        particle.alpha = 1;
        particle.gravity = 0;
        particle.drag = 0;
        particle.rot = 0;
        particle.rotV = 0;
        particle.aux = 0;
        particle.aux2 = 0;
        particle.vx = 0;
        particle.vy = 0;
        particle.life = 1;
        particle.size = 1;
        particle.size1 = 0;
        this.kick();
        return particle;
      }
    }
    return null;
  }

  private kick(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private count(n: number): number {
    return Math.max(1, Math.round(n * this.density));
  }

  emitBurst(x: number, y: number, rgb: Rgb, options: BurstOptions = {}): void {
    const { count = 26, speed = 420, angle, spread = TAU, size = 3, life = 0.5, gravity = 600 } = options;
    for (let i = 0; i < this.count(count); i += 1) {
      const p = this.spawn(Kind.Spark, rgb);
      if (!p) return;
      const a = (angle ?? 0) + (angle === undefined ? rand(0, TAU) : rand(-spread / 2, spread / 2));
      const s = speed * rand(0.35, 1);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.gravity = gravity;
      p.drag = 2.2;
      p.life = life * rand(0.6, 1.2);
      p.size = size * rand(0.6, 1.3);
    }
    for (let i = 0; i < this.count(count / 3); i += 1) {
      const p = this.spawn(Kind.Glow, rgb);
      if (!p) return;
      const a = (angle ?? 0) + (angle === undefined ? rand(0, TAU) : rand(-spread / 2, spread / 2));
      const s = speed * rand(0.1, 0.5);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.drag = 3;
      p.life = life * rand(0.4, 0.8);
      p.size = size * rand(4, 8);
      p.size1 = 0;
      p.alpha = 0.8;
    }
  }

  emitEmbers(x: number, y: number, w: number, h: number, rgb: Rgb, count = 18, rise = 120): void {
    for (let i = 0; i < this.count(count); i += 1) {
      const p = this.spawn(Kind.Ember, rgb);
      if (!p) return;
      p.x = x + rand(0, w);
      p.y = y + rand(0, h);
      p.vx = rand(-24, 24);
      p.vy = -rise * rand(0.5, 1.3);
      p.drag = 0.4;
      p.life = rand(0.7, 1.4);
      p.size = rand(2, 5);
      p.rot = rand(0, TAU);
      p.rotV = rand(2, 6);
    }
  }

  emitDust(x: number, y: number, count = 8, spread = 60): void {
    for (let i = 0; i < this.count(count); i += 1) {
      const p = this.spawn(Kind.Dust, "210,200,185");
      if (!p) return;
      const a = rand(0, TAU);
      p.x = x + Math.cos(a) * rand(0, spread * 0.4);
      p.y = y + Math.sin(a) * rand(0, spread * 0.2);
      p.vx = Math.cos(a) * rand(30, spread * 1.4);
      p.vy = Math.sin(a) * rand(10, spread * 0.5) - 14;
      p.drag = 2.6;
      p.life = rand(0.45, 0.8);
      p.size = rand(10, 22);
      p.size1 = rand(30, 52);
    }
  }

  /** Expanding shockwave ring (optionally squashed vertically via `squash`). */
  emitRing(
    x: number,
    y: number,
    rgb: Rgb,
    options: { radius?: number; from?: number; duration?: number; width?: number; squash?: number } = {},
  ): void {
    const { radius = 150, from = 8, duration = 0.45, width = 7, squash = 1 } = options;
    const p = this.spawn(Kind.Ring, rgb);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.size = from;
    p.size1 = radius;
    p.life = duration;
    p.aux = width;
    p.aux2 = squash;
  }

  emitFlash(x: number, y: number, rgb: Rgb, options: { radius?: number; duration?: number; alpha?: number } = {}): void {
    const { radius = 120, duration = 0.28, alpha = 1 } = options;
    const p = this.spawn(Kind.Glow, rgb);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.size = radius * 0.5;
    p.size1 = radius;
    p.life = duration;
    p.alpha = alpha;
  }

  emitTrail(x: number, y: number, rgb: Rgb, size = 14): void {
    const p = this.spawn(Kind.Glow, rgb);
    if (!p) return;
    p.x = x + rand(-2, 2);
    p.y = y + rand(-2, 2);
    p.vx = rand(-12, 12);
    p.vy = rand(-12, 12);
    p.size = size;
    p.size1 = 0;
    p.life = rand(0.25, 0.4);
    p.alpha = 0.85;
  }

  /** Velocity-aligned streak (dash trails). */
  emitStreak(x: number, y: number, rgb: Rgb, dx: number, dy: number, length = 60, life = 0.28): void {
    const p = this.spawn(Kind.Streak, rgb);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.vx = dx;
    p.vy = dy;
    p.size = length;
    p.life = life;
    p.alpha = 0.8;
  }

  emitPillar(x: number, y: number, rgb: Rgb, options: { height?: number; width?: number; duration?: number } = {}): void {
    const { height = 360, width = 90, duration = 0.8 } = options;
    const p = this.spawn(Kind.Pillar, rgb);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.size = width;
    p.size1 = height;
    p.life = duration;
  }

  emitCircle(x: number, y: number, rgb: Rgb, options: { radius?: number; duration?: number } = {}): void {
    const { radius = 150, duration = 1.1 } = options;
    const p = this.spawn(Kind.Circle, rgb);
    if (!p) return;
    p.x = x;
    p.y = y;
    p.size = radius;
    p.life = duration;
    p.rotV = 0.9;
  }

  private frame = (now: number): void => {
    this.raf = 0;
    this.tick(now);
  };

  /** Advance + draw one frame (public for tests). Reschedules rAF only while particles live. */
  tick(now: number): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    // rAF timestamps can precede `performance.now()` taken at kick time: never step backwards.
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    let alive = 0;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      const t = Math.max(0, p.age / (p.life > 0 ? p.life : 0.001));
      if (t >= 1) {
        p.alive = false;
        this.aliveCount -= 1;
        continue;
      }
      alive += 1;
      this.drawParticle(ctx, p, t, dt);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (alive > 0) this.raf = requestAnimationFrame(this.frame);
    else {
      this.aliveCount = 0;
      ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle, t: number, dt: number): void {
    switch (p.kind) {
      case Kind.Spark: {
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy = p.vy * damp + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalCompositeOperation = "lighter";
        const alpha = (1 - t) * (1 - t);
        ctx.strokeStyle = `rgba(${p.rgb},${alpha.toFixed(3)})`;
        ctx.lineWidth = p.size * (1 - t * 0.6);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.8).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, p.size * 0.35);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
        break;
      }
      case Kind.Ember: {
        p.vx += Math.sin(p.age * 6 + p.rot) * 30 * dt;
        p.y += p.vy * dt;
        p.x += p.vx * dt;
        p.rot += p.rotV * dt;
        const sprite = glowSprite(p.rgb);
        if (!sprite) break;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, (1 - t) * 1.4) * (0.7 + 0.3 * Math.sin(p.age * 18 + p.rot));
        const s = p.size * (1 - t * 0.5) * 4;
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
        ctx.globalAlpha = 1;
        break;
      }
      case Kind.Dust: {
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const sprite = softDust();
        if (!sprite) break;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = (1 - t) * 0.7;
        const s = p.size + (p.size1 - p.size) * easeOut(t);
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
        ctx.globalAlpha = 1;
        break;
      }
      case Kind.Glow: {
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const sprite = glowSprite(p.rgb);
        if (!sprite) break;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = p.alpha * (1 - t) * (1 - t * 0.4);
        const target = p.size1 > 0 ? p.size1 : p.size * 0.2;
        const s = (p.size + (target - p.size) * easeOut(t)) * 2;
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
        ctx.globalAlpha = 1;
        break;
      }
      case Kind.Ring: {
        const e = easeOut(t);
        const r = Math.max(0.5, safeRadius(p.size + (p.size1 - p.size) * e));
        const squash = Math.max(0.01, safeRadius(p.aux2));
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = Math.max(0.8, p.aux * (1 - e));
        ctx.strokeStyle = `rgba(${p.rgb},${(1 - t).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * squash, 0, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = Math.max(0.6, p.aux * 0.3 * (1 - e));
        ctx.strokeStyle = `rgba(255,255,255,${((1 - t) * 0.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 0.96, r * 0.96 * squash, 0, 0, TAU);
        ctx.stroke();
        break;
      }
      case Kind.Pillar: {
        const env = Math.min(t / 0.15, 1) * (1 - Math.max(0, (t - 0.4) / 0.6));
        const w = safeRadius(p.size * (0.5 + 0.5 * (1 - t * 0.6)));
        const h = safeRadius(p.size1);
        const sprite = pillarSprite(p.rgb);
        ctx.globalCompositeOperation = "lighter";
        if (sprite) {
          ctx.globalAlpha = Math.max(0, Math.min(1, env * 0.85));
          ctx.drawImage(sprite, p.x - w / 2, p.y - h, w, h);
          // hot narrow core
          ctx.globalAlpha = Math.max(0, Math.min(1, env * 0.55));
          ctx.drawImage(sprite, p.x - w * 0.14, p.y - h * 0.92, w * 0.28, h * 0.92);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case Kind.Circle: {
        const env = Math.min(t / 0.18, 1) * (1 - Math.max(0, (t - 0.7) / 0.3));
        const r = safeRadius(p.size * (0.7 + 0.3 * easeOut(Math.min(t / 0.25, 1))));
        p.rot += p.rotV * dt;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(${p.rgb},${(0.9 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.82, 0, TAU);
        ctx.stroke();
        // rotating runes (ticks) on the outer band
        ctx.lineWidth = 3;
        for (let i = 0; i < 24; i += 1) {
          const a = p.rot + (i / 24) * TAU;
          const inner = r * (i % 3 === 0 ? 0.86 : 0.9);
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * inner, p.y + Math.sin(a) * inner);
          ctx.lineTo(p.x + Math.cos(a) * r * 0.98, p.y + Math.sin(a) * r * 0.98);
          ctx.stroke();
        }
        // counter-rotating hexagram
        ctx.lineWidth = 1.8;
        for (let tri = 0; tri < 2; tri += 1) {
          ctx.beginPath();
          for (let i = 0; i <= 3; i += 1) {
            const a = -p.rot * 0.8 + (tri * Math.PI) / 3 + (i / 3) * TAU;
            const px = p.x + Math.cos(a) * r * 0.78;
            const py = p.y + Math.sin(a) * r * 0.78;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        const sprite = glowSprite(p.rgb);
        if (sprite) {
          ctx.globalAlpha = 0.45 * env;
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
        }
        break;
      }
      case Kind.Streak: {
        const sprite = streakSprite(p.rgb);
        if (!sprite) break;
        const len = safeRadius(p.size);
        const thick = 6 * (1 - t * 0.7) * 2;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * (1 - t)));
        ctx.save();
        ctx.translate(p.x, p.y);
        // tail points opposite to the travel direction
        ctx.rotate(Math.atan2(-p.vy, -p.vx));
        ctx.drawImage(sprite, 0, -thick / 2, len, thick);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Score / conquer particle burst (board chunk ~500–560). 64 petals + 110 rays,
 * palette `#64ffde` (every 3rd), `#ff5cb0` (every 7th/8th) and `#ecfffa`.
 */

export interface BurstRequest {
  id: string;
  /** Centre relative to the burst layer (CSS px). */
  x: number;
  y: number;
  /** Base radius in CSS px. */
  radius?: number;
}

const PALETTE = ["#64ffde", "#ff5cb0", "#ecfffa"] as const;

function rand(min = 0, max = 1): number {
  return min + Math.random() * (max - min);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fade(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

function envelope(t: number, a: number, b: number, c: number, d: number): number {
  return Math.min(fade(t, a, b), 1 - fade(t, c, d));
}

interface Petal {
  angle: number;
  reach: number;
  spawn: number;
  life: number;
  size: number;
  colour: string;
}

interface Ray {
  angle: number;
  speed: number;
  delay: number;
  width: number;
  colour: string;
}

function makePetals(): Petal[] {
  return Array.from({ length: 64 }, (_, index) => ({
    angle: rand(0, Math.PI * 2),
    reach: 1.1 + 1.2 * Math.random(),
    spawn: 0.06 + Math.random() * 0.78,
    life: 0.42 + 0.24 * Math.random(),
    size: 0.9 + 1.3 * Math.random(),
    colour: index % 3 === 0 ? PALETTE[0] : index % 7 === 0 || index % 8 === 0 ? PALETTE[1] : PALETTE[2],
  }));
}

function makeRays(): Ray[] {
  return Array.from({ length: 110 }, (_, index) => ({
    angle: rand(0, Math.PI * 2),
    speed: 0.6 + 0.9 * Math.random(),
    delay: 0.12 * Math.random(),
    width: 0.6 + 1.1 * Math.random(),
    colour: index % 3 === 0 ? PALETTE[0] : index % 7 === 0 ? PALETTE[1] : PALETTE[2],
  }));
}

function ParticleBurstCanvas({ burst, onDone }: { burst: BurstRequest; onDone: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onDone(burst.id);
      return;
    }
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ctx || reduced) {
      onDone(burst.id);
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.scale(dpr, dpr);
    const radius = burst.radius ?? Math.max(34, Math.min(90, Math.min(width, height) * 0.16));
    const petals = makePetals();
    const rays = makeRays();
    const startedAt = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const t = (now - startedAt) / 1000;
      if (t > 2.2) {
        onDone(burst.id);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(burst.x, burst.y);
      const glow = 0.3 * envelope(t, 0.05, 0.6, 0.95, 1.45);
      if (glow > 0) {
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 3);
        gradient.addColorStop(0, `rgba(100,255,222,${glow * 0.8})`);
        gradient.addColorStop(1, "rgba(100,255,222,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(-radius * 3, -radius * 3, radius * 6, radius * 6);
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (const ray of rays) {
        const local = t - ray.delay;
        if (local <= 0 || local >= 0.75) continue;
        const alpha = 1 - local / 0.75;
        const distance = radius * 0.1 + (local * ray.speed) ** 1.7 * Math.max(width, height) * 0.42;
        const inner = distance - 0.42 * distance * (0.5 + 0.5 * alpha);
        const alpha2 = Math.min(1, 12 * local) * alpha ** 1.3;
        const ux = Math.cos(ray.angle);
        const uy = Math.sin(ray.angle);
        const gradient = ctx.createLinearGradient(ux * inner, uy * inner, ux * distance, uy * distance);
        gradient.addColorStop(0, "rgba(236,255,250,0)");
        gradient.addColorStop(1, `rgba(${hexToRgb(ray.colour)},${alpha2})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = ray.width;
        ctx.beginPath();
        ctx.moveTo(ux * inner, uy * inner);
        ctx.lineTo(ux * distance, uy * distance);
        ctx.stroke();
      }
      for (const petal of petals) {
        const local = (t - petal.spawn) / petal.life;
        if (local <= 0 || local >= 1) continue;
        const distance = radius * 0.35 + radius * petal.reach * (1 - (1 - local) ** 1.6);
        const angle = petal.angle + 2.2 * local * local;
        const alpha = Math.sin(Math.PI * local) ** 0.5;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        ctx.fillStyle = `rgba(${hexToRgb(petal.colour)},${0.9 * alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.6, petal.size * 1.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${hexToRgb(petal.colour)},${0.55 * alpha})`;
        ctx.lineWidth = Math.max(0.6, petal.size * 0.7);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * distance * 0.75, Math.sin(angle) * distance * 0.75);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [burst, onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      data-particle-burst={burst.id}
    />
  );
}

function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  return `${Number.parseInt(value.slice(0, 2), 16)},${Number.parseInt(value.slice(2, 4), 16)},${Number.parseInt(value.slice(4, 6), 16)}`;
}

export function ParticleBurstLayer({ bursts, onDone }: { bursts: BurstRequest[]; onDone: (id: string) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-160" data-particle-burst-layer="true">
      {bursts.map((burst) => (
        <ParticleBurstCanvas key={burst.id} burst={burst} onDone={onDone} />
      ))}
    </div>
  );
}
